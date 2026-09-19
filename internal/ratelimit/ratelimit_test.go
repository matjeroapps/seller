package ratelimit

import (
	"context"
	"testing"
	"time"
)

func TestLimiter_MemoryFallback(t *testing.T) {
	limiter := NewLimiter(nil, 3, 1*time.Minute)
	ctx := context.Background()
	key := "test-key-1"

	// 1st request
	res1 := limiter.Check(ctx, key)
	if !res1.Allowed || res1.Remaining != 2 {
		t.Fatalf("expected allowed=true, remaining=2; got allowed=%v, remaining=%d", res1.Allowed, res1.Remaining)
	}

	// 2nd request
	res2 := limiter.Check(ctx, key)
	if !res2.Allowed || res2.Remaining != 1 {
		t.Fatalf("expected allowed=true, remaining=1; got allowed=%v, remaining=%d", res2.Allowed, res2.Remaining)
	}

	// 3rd request
	res3 := limiter.Check(ctx, key)
	if !res3.Allowed || res3.Remaining != 0 {
		t.Fatalf("expected allowed=true, remaining=0; got allowed=%v, remaining=%d", res3.Allowed, res3.Remaining)
	}

	// 4th request (should be blocked)
	res4 := limiter.Check(ctx, key)
	if res4.Allowed || res4.Remaining != 0 {
		t.Fatalf("expected allowed=false, remaining=0; got allowed=%v, remaining=%d", res4.Allowed, res4.Remaining)
	}
}
