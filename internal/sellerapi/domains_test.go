package sellerapi

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/matjeroapps/seller/internal/auth"
	"github.com/matjeroapps/seller/internal/coreclient"
	"github.com/matjeroapps/seller/internal/i18n"
)

type stubDomainsCore struct {
	subject  string
	storeID  string
	domainID string
	domain   string
	err      error

	domains []coreclient.StoreDomain
	single  coreclient.StoreDomain
}

func (s *stubDomainsCore) ListStoreDomains(ctx context.Context, storeID, subject string) ([]coreclient.StoreDomain, error) {
	s.storeID, s.subject = storeID, subject
	return s.domains, s.err
}

func (s *stubDomainsCore) RequestCustomDomain(ctx context.Context, storeID, subject, domain string) (coreclient.StoreDomain, error) {
	s.storeID, s.subject, s.domain = storeID, subject, domain
	return s.single, s.err
}

func (s *stubDomainsCore) VerifyCustomDomain(ctx context.Context, storeID, domainID, subject string) (coreclient.StoreDomain, error) {
	s.storeID, s.domainID, s.subject = storeID, domainID, subject
	return s.single, s.err
}

func (s *stubDomainsCore) ActivateCustomDomain(ctx context.Context, storeID, domainID, subject string) (coreclient.StoreDomain, error) {
	s.storeID, s.domainID, s.subject = storeID, domainID, subject
	return s.single, s.err
}

func newDomainHandler(domains DomainCapabilities) http.Handler {
	router := chi.NewRouter()
	router.Use(i18n.Middleware(i18n.Default()))
	router.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			next.ServeHTTP(w, r.WithContext(auth.WithPrincipal(r.Context(), auth.Principal{
				Subject: testSubject,
				Roles:   []string{auth.RoleSellerOwner},
			})))
		})
	})
	router.Route("/v1", func(r chi.Router) {
		RegisterSellerDomainRoutes(DomainDependencies{Domains: domains})(r)
	})
	return router
}

func TestSellerDomainRoutesSuccess(t *testing.T) {
	now := time.Now().UTC()
	stub := &stubDomainsCore{
		domains: []coreclient.StoreDomain{
			{
				ID:         "dom-1",
				StoreID:    "store-123",
				Domain:     "store-123.matjero.com",
				IsPrimary:  true,
				Status:     "active",
				DomainType: "platform",
				CreatedAt:  now,
				UpdatedAt:  now,
			},
			{
				ID:         "dom-2",
				StoreID:    "store-123",
				Domain:     "shop.example.com",
				IsPrimary:  false,
				Status:     "pending",
				DomainType: "custom",
				Verification: &coreclient.DomainVerification{
					RecordType:  "TXT",
					RecordName:  "_matjero-verification.shop.example.com",
					RecordValue: "matjero-verification=secret123",
				},
				CreatedAt: now,
				UpdatedAt: now,
			},
		},
		single: coreclient.StoreDomain{
			ID:         "dom-2",
			StoreID:    "store-123",
			Domain:     "shop.example.com",
			IsPrimary:  false,
			Status:     "pending",
			DomainType: "custom",
			Verification: &coreclient.DomainVerification{
				RecordType:  "TXT",
				RecordName:  "_matjero-verification.shop.example.com",
				RecordValue: "matjero-verification=secret123",
			},
			CreatedAt: now,
			UpdatedAt: now,
		},
	}

	handler := newDomainHandler(stub)

	t.Run("GET list store domains", func(t *testing.T) {
		rec := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/store-123/domains", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}
		if stub.storeID != "store-123" || stub.subject != testSubject {
			t.Errorf("unexpected storeID %s or subject %s", stub.storeID, stub.subject)
		}
		body := rec.Body.String()
		if !strings.Contains(body, "shop.example.com") || !strings.Contains(body, "_matjero-verification.shop.example.com") {
			t.Errorf("missing expected domain data: %s", body)
		}
		// Privacy check: verification_token must NOT be present
		if strings.Contains(body, "verification_token") {
			t.Errorf("privacy violation: verification_token leaked in response: %s", body)
		}
	})

	t.Run("POST request custom domain", func(t *testing.T) {
		rec := doRequest(t, handler, http.MethodPost, "/v1/seller/stores/store-123/domains", `{"domain":"shop.example.com"}`)
		if rec.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
		}
		if stub.domain != "shop.example.com" {
			t.Errorf("expected domain shop.example.com, got %s", stub.domain)
		}
		if strings.Contains(rec.Body.String(), "verification_token") {
			t.Errorf("privacy violation: verification_token leaked: %s", rec.Body.String())
		}
	})

	t.Run("POST verify custom domain", func(t *testing.T) {
		stub.single.Status = "verified"
		rec := doRequest(t, handler, http.MethodPost, "/v1/seller/stores/store-123/domains/dom-2/verify", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}
		if stub.domainID != "dom-2" {
			t.Errorf("expected domainID dom-2, got %s", stub.domainID)
		}
	})

	t.Run("POST activate custom domain", func(t *testing.T) {
		stub.single.Status = "active"
		stub.single.IsPrimary = true
		rec := doRequest(t, handler, http.MethodPost, "/v1/seller/stores/store-123/domains/dom-2/activate", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}
		if stub.domainID != "dom-2" {
			t.Errorf("expected domainID dom-2, got %s", stub.domainID)
		}
	})
}

func TestSellerDomainRoutesErrorMapping(t *testing.T) {
	cases := []struct {
		name       string
		coreErr    error
		wantStatus int
		wantCode   string
	}{
		{
			name:       "not found / cross seller",
			coreErr:    &coreclient.Error{Status: http.StatusNotFound, Code: coreclient.CodeNotFound, Message: "store not found"},
			wantStatus: http.StatusNotFound,
			wantCode:   "not_found",
		},
		{
			name:       "conflict",
			coreErr:    &coreclient.Error{Status: http.StatusConflict, Code: coreclient.CodeConflict, Message: "duplicate domain"},
			wantStatus: http.StatusConflict,
			wantCode:   "conflict",
		},
		{
			name:       "validation error",
			coreErr:    &coreclient.Error{Status: http.StatusBadRequest, Code: coreclient.CodeValidationError, Message: "invalid domain format"},
			wantStatus: http.StatusBadRequest,
			wantCode:   "validation_error",
		},
		{
			name:       "dns service unavailable",
			coreErr:    &coreclient.Error{Status: http.StatusServiceUnavailable, Code: coreclient.CodeUnavailable, Message: "dns lookup timeout"},
			wantStatus: http.StatusServiceUnavailable,
			wantCode:   "service_unavailable",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			stub := &stubDomainsCore{err: tc.coreErr}
			handler := newDomainHandler(stub)
			rec := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/store-123/domains", "")
			if rec.Code != tc.wantStatus {
				t.Fatalf("expected status %d, got %d: %s", tc.wantStatus, rec.Code, rec.Body.String())
			}
			errCode := decodeError(t, rec)
			if errCode != tc.wantCode {
				t.Errorf("expected error code %s, got %s", tc.wantCode, errCode)
			}
		})
	}
}
