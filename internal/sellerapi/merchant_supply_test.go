package sellerapi

// Contract tests for the Merchant-authorized supply read pass-throughs
// (Feature 025). They prove the handlers forward the verified subject to the
// Core client, map Core errors honestly, and return genuine empty results.

import (
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	"github.com/go-chi/chi/v5"

	"seller/internal/auth"
	"seller/internal/coreclient"
)

func newSupplyHandler(core CoreCapabilities) http.Handler {
	router := chi.NewRouter()
	router.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			next.ServeHTTP(w, r.WithContext(auth.WithPrincipal(r.Context(), auth.Principal{
				Subject: testSubject,
				Roles:   []string{auth.RoleSellerOwner},
			})))
		})
	})
	router.Route("/v1", func(r chi.Router) {
		RegisterMerchantSupplyRoutes(Dependencies{Core: core})(r)
	})
	return router
}

func TestMerchantSupplyPassThroughForwardsSubjectAndReturnsEmpty(t *testing.T) {
	stub := &stubCore{}
	handler := newSupplyHandler(stub)

	paths := []string{
		"/v1/merchants/m-1/integrations/connections",
		"/v1/merchants/m-1/integrations/supply/import-batches",
		"/v1/merchants/m-1/integrations/supply/review-cases",
		"/v1/merchants/m-1/integrations/supply/mappings",
		"/v1/merchants/m-1/integrations/supply/cursors",
		"/v1/merchants/m-1/integrations/supply/fulfillment-requests",
	}
	for _, path := range paths {
		rec := doRequest(t, handler, http.MethodGet, path, "")
		if rec.Code != http.StatusOK {
			t.Fatalf("%s: status = %d, want 200 (body %q)", path, rec.Code, rec.Body.String())
		}
		var items []any
		if err := json.Unmarshal(rec.Body.Bytes(), &items); err != nil {
			t.Fatalf("%s: expected a JSON collection, got %q", path, rec.Body.String())
		}
		if items == nil {
			t.Errorf("%s: expected genuine empty list (non-nil), got null", path)
		}
		if stub.subject != testSubject {
			t.Errorf("%s: expected verified subject forwarding, got %q", path, stub.subject)
		}
	}
}

func TestMerchantSupplyPassThroughDetailRoutes(t *testing.T) {
	stub := &stubCore{}
	handler := newSupplyHandler(stub)

	details := []struct {
		path string
		id   string
	}{
		{"/v1/merchants/m-1/integrations/connections/conn-1", "conn-1"},
		{"/v1/merchants/m-1/integrations/supply/import-batches/batch-1", "batch-1"},
		{"/v1/merchants/m-1/integrations/supply/review-cases/case-1", "case-1"},
		{"/v1/merchants/m-1/integrations/supply/mappings/map-1", "map-1"},
		{"/v1/merchants/m-1/integrations/supply/fulfillment-requests/req-1", "req-1"},
	}
	for _, d := range details {
		rec := doRequest(t, handler, http.MethodGet, d.path, "")
		if rec.Code != http.StatusOK {
			t.Fatalf("%s: status = %d (body %q)", d.path, rec.Code, rec.Body.String())
		}
		if stub.subject != testSubject {
			t.Errorf("%s: subject not forwarded", d.path)
		}
	}
}

func TestMerchantSupplyPassThroughMapsCoreErrors(t *testing.T) {
	stub := &stubCore{err: &coreclient.Error{Status: http.StatusForbidden, Code: coreclient.CodeForbidden}}
	handler := newSupplyHandler(stub)

	rec := doRequest(t, handler, http.MethodGet, "/v1/merchants/m-1/integrations/supply/import-batches", "")
	if rec.Code != http.StatusForbidden {
		t.Fatalf("core 403 must surface as 403, got %d", rec.Code)
	}

	stub = &stubCore{err: &coreclient.Error{Status: http.StatusNotFound, Code: coreclient.CodeNotFound}}
	handler = newSupplyHandler(stub)
	rec = doRequest(t, handler, http.MethodGet, "/v1/merchants/m-1/integrations/supply/import-batches/batch-x", "")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("core 404 must surface as 404, got %d", rec.Code)
	}

	stub = &stubCore{err: errors.New("core unreachable")}
	handler = newSupplyHandler(stub)
	rec = doRequest(t, handler, http.MethodGet, "/v1/merchants/m-1/integrations/supply/import-batches", "")
	if rec.Code != http.StatusBadGateway && rec.Code != http.StatusInternalServerError {
		t.Fatalf("core outage must surface as 502/500, got %d", rec.Code)
	}
}
