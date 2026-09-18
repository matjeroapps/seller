package observability_test

import (
	"context"
	"testing"

	"github.com/matjeroapps/seller/internal/config"
	"github.com/matjeroapps/seller/internal/observability"
)

func TestInit(t *testing.T) {
	cfg := config.Config{
		ServiceName: "seller-test",
		Environment: "testing",
	}

	shutdown, err := observability.Init(context.Background(), cfg)
	if err != nil {
		t.Fatalf("observability.Init failed: %v", err)
	}
	defer func() {
		if err := shutdown(context.Background()); err != nil {
			t.Errorf("shutdown failed: %v", err)
		}
	}()
}
