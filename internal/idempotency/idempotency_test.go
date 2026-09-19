package idempotency

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestIdempotency_Middleware(t *testing.T) {
	store := NewStore(nil, 1*time.Hour)
	handler := Middleware(store, true)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"status":"created"}`))
	}))

	t.Run("missing idempotency key when required", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/test", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 Bad Request, got %d", rec.Code)
		}
	})

	t.Run("first mutation succeeds and second returns cached response", func(t *testing.T) {
		req1 := httptest.NewRequest(http.MethodPost, "/test", nil)
		req1.Header.Set("Idempotency-Key", "key-xyz-123")
		rec1 := httptest.NewRecorder()
		handler.ServeHTTP(rec1, req1)

		if rec1.Code != http.StatusCreated {
			t.Fatalf("expected 201 Created on 1st request, got %d", rec1.Code)
		}

		req2 := httptest.NewRequest(http.MethodPost, "/test", nil)
		req2.Header.Set("Idempotency-Key", "key-xyz-123")
		rec2 := httptest.NewRecorder()
		handler.ServeHTTP(rec2, req2)

		if rec2.Code != http.StatusCreated {
			t.Fatalf("expected 201 Created on 2nd request (cached), got %d", rec2.Code)
		}
		if rec2.Header().Get("X-Cache-Lookup") != "HIT-IDEMPOTENCY" {
			t.Fatalf("expected X-Cache-Lookup HIT-IDEMPOTENCY header")
		}
	})
}
