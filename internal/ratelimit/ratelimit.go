package ratelimit

import (
	"context"
	"fmt"
	"sync"
	"time"

	"seller/internal/redisx"
)

// Result represents the outcome of a rate-limit check.
type Result struct {
	Limit     int   `json:"limit"`
	Remaining int   `json:"remaining"`
	Reset     int64 `json:"reset"`
	Allowed   bool  `json:"allowed"`
}

// Config configures the rate limiter.
type Config struct {
	Limit  int
	Window time.Duration
}

// Limiter provides real rate-limiting backed by Redis when available,
// falling back to a thread-safe in-memory sliding/fixed window store.
type Limiter struct {
	redis  *redisx.Client
	limit  int
	window time.Duration

	mu    sync.Mutex
	local map[string]*windowCounter
}

type windowCounter struct {
	count     int
	resetTime time.Time
}

// NewLimiter constructs a Limiter.
func NewLimiter(redis *redisx.Client, limit int, window time.Duration) *Limiter {
	if limit <= 0 {
		limit = 1000
	}
	if window <= 0 {
		window = 1 * time.Hour
	}
	return &Limiter{
		redis:  redis,
		limit:  limit,
		window: window,
		local:  make(map[string]*windowCounter),
	}
}

// Check evaluates whether a request identified by key is allowed.
func (l *Limiter) Check(ctx context.Context, key string) Result {
	now := time.Now()

	// Try Redis if available
	if l.redis != nil {
		res, err := l.checkRedis(ctx, key, now)
		if err == nil {
			return res
		}
	}

	// Fall back to thread-safe in-memory window
	return l.checkLocal(key, now)
}

func (l *Limiter) checkRedis(ctx context.Context, key string, now time.Time) (Result, error) {
	windowKey := fmt.Sprintf("ratelimit:%s:%d", key, now.Unix()/int64(l.window.Seconds()))
	resetTs := (now.Unix()/int64(l.window.Seconds()) + 1) * int64(l.window.Seconds())

	val, found, err := l.redis.Get(ctx, windowKey)
	if err != nil {
		return Result{}, err
	}

	count := 0
	if found {
		fmt.Sscanf(string(val), "%d", &count)
	}

	count++
	if err := l.redis.Set(ctx, windowKey, []byte(fmt.Sprintf("%d", count)), l.window); err != nil {
		return Result{}, err
	}

	remaining := l.limit - count
	allowed := true
	if remaining < 0 {
		remaining = 0
		allowed = false
	}

	return Result{
		Limit:     l.limit,
		Remaining: remaining,
		Reset:     resetTs,
		Allowed:   allowed,
	}, nil
}

func (l *Limiter) checkLocal(key string, now time.Time) Result {
	l.mu.Lock()
	defer l.mu.Unlock()

	entry, exists := l.local[key]
	if !exists || now.After(entry.resetTime) {
		entry = &windowCounter{
			count:     0,
			resetTime: now.Add(l.window),
		}
		l.local[key] = entry
	}

	entry.count++
	remaining := l.limit - entry.count
	allowed := true
	if remaining < 0 {
		remaining = 0
		allowed = false
	}

	return Result{
		Limit:     l.limit,
		Remaining: remaining,
		Reset:     entry.resetTime.Unix(),
		Allowed:   allowed,
	}
}
