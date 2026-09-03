package sellerapi

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/matjeroapps/seller/internal/actorhttp"
	"github.com/matjeroapps/seller/internal/coreclient"
	"github.com/matjeroapps/seller/internal/httpx"
)

// DomainCapabilities describes the Core domain operations required by seller routes.
type DomainCapabilities interface {
	ListStoreDomains(ctx context.Context, storeID, subject string) ([]coreclient.StoreDomain, error)
	RequestCustomDomain(ctx context.Context, storeID, subject, domain string) (coreclient.StoreDomain, error)
	VerifyCustomDomain(ctx context.Context, storeID, domainID, subject string) (coreclient.StoreDomain, error)
	ActivateCustomDomain(ctx context.Context, storeID, domainID, subject string) (coreclient.StoreDomain, error)
}

// DomainDependencies wires the Store Domain routes.
type DomainDependencies struct {
	Domains DomainCapabilities
}

type domainServer struct {
	deps DomainDependencies
}

// RegisterSellerDomainRoutes registers seller domain management endpoints.
func RegisterSellerDomainRoutes(deps DomainDependencies) func(r chi.Router) {
	s := domainServer{deps: deps}
	return func(r chi.Router) {
		r.Get("/seller/stores/{store_id}/domains", s.handleListDomains)
		r.Post("/seller/stores/{store_id}/domains", s.handleRequestCustomDomain)
		r.Post("/seller/stores/{store_id}/domains/{domain_id}/verify", s.handleVerifyCustomDomain)
		r.Post("/seller/stores/{store_id}/domains/{domain_id}/activate", s.handleActivateCustomDomain)
	}
}

func (s domainServer) subject(w http.ResponseWriter, r *http.Request) (string, bool) {
	subject, err := actorhttp.SubjectFrom(r)
	if err != nil {
		writeDomainError(w, err)
		return "", false
	}
	return subject, true
}

func writeDomainError(w http.ResponseWriter, err error) {
	var coreErr *coreclient.Error
	if errors.As(err, &coreErr) {
		switch coreErr.Code {
		case coreclient.CodeNotFound:
			httpx.WriteError(w, http.StatusNotFound, "not_found", "store or domain not found")
		case coreclient.CodeConflict:
			httpx.WriteError(w, http.StatusConflict, "conflict", "domain conflict or illegal lifecycle transition")
		case coreclient.CodeValidationError, coreclient.CodeInvalidArgument:
			httpx.WriteError(w, http.StatusBadRequest, "validation_error", "invalid domain")
		case coreclient.CodeUnauthorized:
			httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "unauthenticated")
		case coreclient.CodeForbidden:
			httpx.WriteError(w, http.StatusForbidden, "forbidden", "access denied")
		case coreclient.CodeUnavailable:
			httpx.WriteError(w, http.StatusServiceUnavailable, "service_unavailable", "service temporarily unavailable")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "internal error")
		}
		return
	}

	if errors.Is(err, coreclient.ErrUnavailable) || errors.Is(err, context.DeadlineExceeded) {
		httpx.WriteError(w, http.StatusServiceUnavailable, "service_unavailable", "service temporarily unavailable")
		return
	}
	httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "internal error")
}

func (s domainServer) handleListDomains(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subject(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	items, err := s.deps.Domains.ListStoreDomains(r.Context(), storeID, subject)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	resp := make([]StoreDomainResponse, 0, len(items))
	for _, d := range items {
		resp = append(resp, toStoreDomainResponse(d))
	}
	httpx.WriteJSON(w, http.StatusOK, StoreDomainCollectionResponse{Items: resp})
}

func (s domainServer) handleRequestCustomDomain(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subject(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	var body RequestCustomDomainRequest
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	domainInput := strings.TrimSpace(body.Domain)
	if domainInput == "" {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "domain is required")
		return
	}
	domain, err := s.deps.Domains.RequestCustomDomain(r.Context(), storeID, subject, domainInput)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toStoreDomainResponse(domain))
}

func (s domainServer) handleVerifyCustomDomain(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subject(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	domainID := chi.URLParam(r, "domain_id")
	domain, err := s.deps.Domains.VerifyCustomDomain(r.Context(), storeID, domainID, subject)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toStoreDomainResponse(domain))
}

func (s domainServer) handleActivateCustomDomain(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subject(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	domainID := chi.URLParam(r, "domain_id")
	domain, err := s.deps.Domains.ActivateCustomDomain(r.Context(), storeID, domainID, subject)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toStoreDomainResponse(domain))
}

func toStoreDomainResponse(d coreclient.StoreDomain) StoreDomainResponse {
	resp := StoreDomainResponse{
		ID:            d.ID,
		Domain:        d.Domain,
		IsPrimary:     d.IsPrimary,
		Status:        d.Status,
		DomainType:    d.DomainType,
		VerifiedAt:    d.VerifiedAt,
		LastCheckedAt: d.LastCheckedAt,
		CreatedAt:     d.CreatedAt,
		UpdatedAt:     d.UpdatedAt,
	}
	if d.Verification != nil {
		resp.Verification = &DomainVerificationResponse{
			RecordType:  d.Verification.RecordType,
			RecordName:  d.Verification.RecordName,
			RecordValue: d.Verification.RecordValue,
		}
	}
	return resp
}

// --- Domain Public Response DTOs ---

type StoreDomainResponse struct {
	ID            string                      `json:"id"`
	Domain        string                      `json:"domain"`
	IsPrimary     bool                        `json:"is_primary"`
	Status        string                      `json:"status"`
	DomainType    string                      `json:"domain_type"`
	VerifiedAt    *time.Time                  `json:"verified_at,omitempty"`
	LastCheckedAt *time.Time                  `json:"last_checked_at,omitempty"`
	Verification  *DomainVerificationResponse `json:"verification,omitempty"`
	CreatedAt     time.Time                   `json:"created_at"`
	UpdatedAt     time.Time                   `json:"updated_at"`
}

type DomainVerificationResponse struct {
	RecordType  string `json:"record_type"`
	RecordName  string `json:"record_name"`
	RecordValue string `json:"record_value"`
}

type StoreDomainCollectionResponse struct {
	Items []StoreDomainResponse `json:"items"`
}

type RequestCustomDomainRequest struct {
	Domain string `json:"domain"`
}
