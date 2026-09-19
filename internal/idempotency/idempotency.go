package idempotency

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"seller/internal/httpx"
	"seller/internal/redisx"
)

const (
	StatusProcessing = "processing"
	StatusCompleted  = "completed"
	DefaultTTL       = 24 * time.Hour
)

type CachedResponse struct {
	StatusCode int               `json:"status_code"`
	Headers    map[string]string `json:"headers"`
	Body       []byte            `json:"body"`
}

type Record struct {
	Status   string          `json:"status"`
	Response *CachedResponse `json:"response,omitempty"`
}

type Store struct {
	redis *redisx.Client
	ttl   time.Duration

	mu    sync.Mutex
	local map[string]*Record
}

func NewStore(redis *redisx.Client, ttl time.Duration) *Store {
	if ttl <= 0 {
		ttl = DefaultTTL
	}
	return &Store{
		redis: redis,
		ttl:   ttl,
		local: make(map[string]*Record),
	}
}

func (s *Store) Get(ctx context.Context, key, actorID string) (*Record, error) {
	fullKey := fmt.Sprintf("idempotency:%s:%s", actorID, key)

	if s.redis != nil {
		val, found, err := s.redis.Get(ctx, fullKey)
		if err == nil && found {
			var rec Record
			if err := json.Unmarshal(val, &rec); err == nil {
				return &rec, nil
			}
		}
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if rec, found := s.local[fullKey]; found {
		return rec, nil
	}

	return nil, nil
}

func (s *Store) Lock(ctx context.Context, key, actorID string) (status string, cached *CachedResponse, release func(), err error) {
	fullKey := fmt.Sprintf("idempotency:%s:%s", actorID, key)

	rec, err := s.Get(ctx, key, actorID)
	if err != nil {
		return "", nil, nil, err
	}

	if rec != nil {
		if rec.Status == StatusProcessing {
			return StatusProcessing, nil, nil, nil
		}
		if rec.Status == StatusCompleted && rec.Response != nil {
			return StatusCompleted, rec.Response, nil, nil
		}
	}

	// Mark processing
	newRec := &Record{Status: StatusProcessing}
	if s.redis != nil {
		b, _ := json.Marshal(newRec)
		_ = s.redis.Set(ctx, fullKey, b, 5*time.Minute) // temporary lock TTL
	}

	s.mu.Lock()
	s.local[fullKey] = newRec
	s.mu.Unlock()

	release = func() {
		// No-op or cleanup on failure if needed
	}

	return "", nil, release, nil
}

func (s *Store) Save(ctx context.Context, key, actorID string, statusCode int, headers map[string]string, body []byte) error {
	fullKey := fmt.Sprintf("idempotency:%s:%s", actorID, key)

	rec := &Record{
		Status: StatusCompleted,
		Response: &CachedResponse{
			StatusCode: statusCode,
			Headers:    headers,
			Body:       body,
		},
	}

	if s.redis != nil {
		b, err := json.Marshal(rec)
		if err == nil {
			_ = s.redis.Set(ctx, fullKey, b, s.ttl)
		}
	}

	s.mu.Lock()
	s.local[fullKey] = rec
	s.mu.Unlock()

	return nil
}

// Middleware returns an HTTP handler middleware for idempotency enforcement.
func Middleware(store *Store, requireHeader bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			key := r.Header.Get("Idempotency-Key")
			if key == "" {
				key = r.Header.Get("X-Idempotency-Key")
			}

			if key == "" {
				if requireHeader {
					httpx.WriteError(w, http.StatusBadRequest, "missing_idempotency_key", "Idempotency-Key header is required for mutation requests")
					return
				}
				next.ServeHTTP(w, r)
				return
			}

			actorID := r.Header.Get("X-Matjero-API-Key")
			if actorID == "" {
				actorID = r.Header.Get("Authorization")
			}
			if actorID == "" {
				actorID = "anonymous"
			}

			status, cached, _, err := store.Lock(r.Context(), key, actorID)
			if err != nil {
				httpx.WriteError(w, http.StatusInternalServerError, "idempotency_error", "failed to evaluate idempotency key")
				return
			}

			if status == StatusProcessing {
				httpx.WriteError(w, http.StatusConflict, "concurrent_request", "request with idempotency key is currently processing")
				return
			}

			if status == StatusCompleted && cached != nil {
				for k, v := range cached.Headers {
					w.Header().Set(k, v)
				}
				w.Header().Set("X-Cache-Lookup", "HIT-IDEMPOTENCY")
				w.WriteHeader(cached.StatusCode)
				_, _ = w.Write(cached.Body)
				return
			}

			rec := &responseInterceptor{ResponseWriter: w, body: &bytes.Buffer{}, headers: make(map[string]string)}
			next.ServeHTTP(rec, r)

			if rec.statusCode >= 200 && rec.statusCode < 300 {
				for k, v := range rec.Header() {
					if len(v) > 0 {
						rec.headers[k] = v[0]
					}
				}
				_ = store.Save(r.Context(), key, actorID, rec.statusCode, rec.headers, rec.body.Bytes())
			}
		})
	}
}

type responseInterceptor struct {
	http.ResponseWriter
	statusCode int
	body       *bytes.Buffer
	headers    map[string]string
}

func (ri *responseInterceptor) WriteHeader(statusCode int) {
	ri.statusCode = statusCode
	ri.ResponseWriter.WriteHeader(statusCode)
}

func (ri *responseInterceptor) Write(b []byte) (int, error) {
	if ri.statusCode == 0 {
		ri.statusCode = http.StatusOK
	}
	ri.body.Write(b)
	return ri.ResponseWriter.Write(b)
}
