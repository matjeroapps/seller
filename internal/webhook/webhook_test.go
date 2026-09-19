package webhook

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestWebhookClient_DeliverAndSignature(t *testing.T) {
	received := false
	var receivedSig string

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received = true
		receivedSig = r.Header.Get("X-Matjero-Signature")
		if r.Header.Get("User-Agent") != "Matjero-Webhook/1.0" {
			t.Errorf("unexpected User-Agent: %s", r.Header.Get("User-Agent"))
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer ts.Close()

	client := NewClient(2*time.Second, 1)

	payload := EventPayload{
		ID:         "evt_123",
		EventType:  "order.created",
		APIVersion: "2026-09-01",
		CreatedAt:  time.Now(),
		ActorType:  "seller",
		ActorID:    "store-1",
		Data:       json.RawMessage(`{"order_id":"ord_100"}`),
	}

	code, err := client.Deliver(context.Background(), ts.URL, "secret_key_999", payload)
	if err != nil {
		t.Fatalf("expected successful delivery, got err: %v", err)
	}
	if code != 200 {
		t.Fatalf("expected status 200, got %d", code)
	}
	if !received {
		t.Fatalf("expected server to receive request")
	}
	if !strings.Contains(receivedSig, "v1=") {
		t.Fatalf("expected signature header to contain v1=, got %s", receivedSig)
	}
}

func TestValidateTargetURL(t *testing.T) {
	if err := ValidateTargetURL("https://example.com/webhook"); err != nil {
		t.Fatalf("valid URL rejected: %v", err)
	}
	if err := ValidateTargetURL("ftp://example.com/webhook"); err == nil {
		t.Fatalf("ftp URL should be rejected")
	}
	if err := ValidateTargetURL("invalid-url"); err == nil {
		t.Fatalf("malformed URL should be rejected")
	}
}
