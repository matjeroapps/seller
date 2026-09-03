package coreclient

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
)

func TestListStoreDomains(t *testing.T) {
	stub := newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("expected GET, got %s", r.Method)
		}
		if r.URL.Path != "/internal/v1/stores/store-123/domains" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Header.Get("X-Matjero-Service") != testService {
			t.Errorf("expected service %s, got %s", testService, r.Header.Get("X-Matjero-Service"))
		}
		if r.Header.Get("X-Matjero-Subject") != "user-sub-1" {
			t.Errorf("expected subject user-sub-1, got %s", r.Header.Get("X-Matjero-Subject"))
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"items": [
				{
					"id": "dom-1",
					"store_id": "store-123",
					"domain": "store-123.matjero.com",
					"is_primary": true,
					"status": "active",
					"domain_type": "platform",
					"created_at": "2026-01-01T00:00:00Z",
					"updated_at": "2026-01-01T00:00:00Z"
				},
				{
					"id": "dom-2",
					"store_id": "store-123",
					"domain": "shop.example.com",
					"is_primary": false,
					"status": "pending",
					"domain_type": "custom",
					"verification": {
						"record_type": "TXT",
						"record_name": "_matjero-verification.shop.example.com",
						"record_value": "matjero-verification=secret123"
					},
					"created_at": "2026-01-02T00:00:00Z",
					"updated_at": "2026-01-02T00:00:00Z"
				}
			]
		}`))
	})

	client := stub.client(t)
	domains, err := client.ListStoreDomains(context.Background(), "store-123", "user-sub-1")
	if err != nil {
		t.Fatalf("ListStoreDomains failed: %v", err)
	}

	if len(domains) != 2 {
		t.Fatalf("expected 2 domains, got %d", len(domains))
	}
	if domains[0].Domain != "store-123.matjero.com" || !domains[0].IsPrimary {
		t.Errorf("unexpected platform domain: %+v", domains[0])
	}
	if domains[1].Domain != "shop.example.com" || domains[1].Verification == nil {
		t.Errorf("unexpected custom domain: %+v", domains[1])
	}
	if domains[1].Verification.RecordName != "_matjero-verification.shop.example.com" {
		t.Errorf("unexpected verification record name: %s", domains[1].Verification.RecordName)
	}
}

func TestRequestCustomDomain(t *testing.T) {
	var capturedBody []byte
	var stub *stubCore
	stub = newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
		capturedBody = stub.lastBody
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/internal/v1/stores/store-123/domains" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"id": "dom-2",
			"store_id": "store-123",
			"domain": "shop.example.com",
			"is_primary": false,
			"status": "pending",
			"domain_type": "custom",
			"verification": {
				"record_type": "TXT",
				"record_name": "_matjero-verification.shop.example.com",
				"record_value": "matjero-verification=secret123"
			},
			"created_at": "2026-01-02T00:00:00Z",
			"updated_at": "2026-01-02T00:00:00Z"
		}`))
	})

	client := stub.client(t)
	domain, err := client.RequestCustomDomain(context.Background(), "store-123", "user-sub-1", "shop.example.com")
	if err != nil {
		t.Fatalf("RequestCustomDomain failed: %v", err)
	}
	if domain.ID != "dom-2" || domain.Status != "pending" {
		t.Errorf("unexpected response: %+v", domain)
	}

	var req CustomDomainRequest
	if err := json.Unmarshal(capturedBody, &req); err != nil {
		t.Fatalf("failed to decode request body: %v", err)
	}
	if req.Domain != "shop.example.com" {
		t.Errorf("expected domain shop.example.com, got %s", req.Domain)
	}
}

func TestVerifyCustomDomain(t *testing.T) {
	stub := newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/internal/v1/stores/store-123/domains/dom-2/verify" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"id": "dom-2",
			"store_id": "store-123",
			"domain": "shop.example.com",
			"is_primary": false,
			"status": "verified",
			"domain_type": "custom",
			"created_at": "2026-01-02T00:00:00Z",
			"updated_at": "2026-01-02T00:00:00Z"
		}`))
	})

	client := stub.client(t)
	domain, err := client.VerifyCustomDomain(context.Background(), "store-123", "dom-2", "user-sub-1")
	if err != nil {
		t.Fatalf("VerifyCustomDomain failed: %v", err)
	}
	if domain.ID != "dom-2" || domain.Status != "verified" {
		t.Errorf("unexpected response: %+v", domain)
	}
}

func TestActivateCustomDomain(t *testing.T) {
	stub := newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/internal/v1/stores/store-123/domains/dom-2/activate" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"id": "dom-2",
			"store_id": "store-123",
			"domain": "shop.example.com",
			"is_primary": true,
			"status": "active",
			"domain_type": "custom",
			"created_at": "2026-01-02T00:00:00Z",
			"updated_at": "2026-01-02T00:00:00Z"
		}`))
	})

	client := stub.client(t)
	domain, err := client.ActivateCustomDomain(context.Background(), "store-123", "dom-2", "user-sub-1")
	if err != nil {
		t.Fatalf("ActivateCustomDomain failed: %v", err)
	}
	if domain.ID != "dom-2" || domain.Status != "active" || !domain.IsPrimary {
		t.Errorf("unexpected response: %+v", domain)
	}
}
