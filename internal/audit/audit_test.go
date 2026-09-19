package audit

import (
	"bytes"
	"context"
	"log/slog"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestAuditLogger(t *testing.T) {
	var buf bytes.Buffer
	handler := slog.NewJSONHandler(&buf, nil)
	logger := slog.New(handler)

	al := NewLogger(logger)

	req := httptest.NewRequest("POST", "/v1/public/inventory/adjustments", nil)
	req.Header.Set("X-Correlation-Id", "corr-123")

	al.Log(context.Background(), "api_key", "key-123", "inventory.adjust", "store-1", "POST", 200, time.Now().Add(-10*time.Millisecond), req)

	logOutput := buf.String()
	if !strings.Contains(logOutput, "audit_event") || !strings.Contains(logOutput, "corr-123") {
		t.Fatalf("expected log output to contain audit_event and corr-123, got: %s", logOutput)
	}
}
