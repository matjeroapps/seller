// Package storefrontapi hosts the public, anonymous HTTP surface of the native
// storefront.
//
// Tenant identity is derived exclusively from the trusted request host. The
// resolved host is forwarded to Core, which resolves the store and applies the
// catalog scope; the catalog read model itself is a Core-owned business
// capability reached over HTTP (ADR-017). Client-supplied store or seller
// identifiers are never read on these routes.
package storefrontapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/matjeroapps/seller/internal/config"
	"github.com/matjeroapps/seller/internal/coreclient"
	"github.com/matjeroapps/seller/internal/httpx"
	"github.com/matjeroapps/seller/internal/i18n"
)

// errInvalidQuery means the caller supplied an unusable filter, sort, or page.
// It is raised locally during request parsing; Core enforces the rest.
var errInvalidQuery = errors.New("invalid catalog query")

// CatalogReader is the public catalog read model. *coreclient.Client satisfies
// it; the interface exists so handlers can be tested against a stub Core server
// without any database.
type CatalogReader interface {
	StorefrontStore(ctx context.Context, host string, locale i18n.Locale) (coreclient.StoreBootstrap, error)
	StorefrontCategories(ctx context.Context, host string, locale i18n.Locale) ([]coreclient.CategoryNode, error)
	StorefrontCategory(ctx context.Context, host, slug string, locale i18n.Locale) (coreclient.CategoryNode, error)
	StorefrontProducts(ctx context.Context, host string, query coreclient.ProductQuery, locale i18n.Locale) (coreclient.ProductPage, error)
	StorefrontProduct(ctx context.Context, host, slug string, locale i18n.Locale) (coreclient.ProductDetail, error)
	StorefrontSearch(ctx context.Context, host string, query coreclient.ProductQuery, locale i18n.Locale) (coreclient.ProductPage, error)
}

// Dependencies wires the public catalog routes. Config supplies the trusted
// forwarded-host policy established in P4.1; host parsing is not reimplemented
// here.
type Dependencies struct {
	Catalog  CatalogReader
	Platform config.Config
}

// RegisterStorefrontRoutes registers the public catalog routes under /v1.
func RegisterStorefrontRoutes(deps Dependencies) func(r chi.Router) {
	return func(r chi.Router) {
		r.Get("/storefront/store", deps.handleStore)
		r.Get("/storefront/categories", deps.handleCategories)
		r.Get("/storefront/categories/{slug}", deps.handleCategory)
		r.Get("/storefront/products", deps.handleProducts)
		r.Get("/storefront/products/{slug}", deps.handleProduct)
		r.Get("/storefront/search", deps.handleSearch)
	}
}

// hostFor extracts the trusted storefront host from the request using the
// deployment's own proxy policy.
//
// The request Host header is authoritative by default. X-Forwarded-Host is only
// honored when the deployment explicitly trusts a reverse proxy
// (config.TrustedForwardedHost), which prevents hostname spoofing by an
// untrusted client. The result is forwarded to Core as the tenant authority;
// Core ignores the HTTP Host entirely.
func (deps Dependencies) hostFor(r *http.Request) string {
	host := r.Host
	if deps.Platform.TrustedForwardedHost {
		if forwarded := r.Header.Get("X-Forwarded-Host"); forwarded != "" {
			// Take the first host when multiple are comma-separated.
			if i := strings.IndexByte(forwarded, ','); i >= 0 {
				forwarded = forwarded[:i]
			}
			host = forwarded
		}
	}
	return normalizeHost(host)
}

// normalizeHost lowercases a host and strips any port and surrounding
// whitespace. Core performs the authoritative domain normalization; this only
// produces the value that is forwarded, so both sides agree on what a host is
// before it is sent.
func normalizeHost(host string) string {
	host = strings.ToLower(strings.TrimSpace(host))
	if i := strings.IndexByte(host, ':'); i >= 0 {
		host = host[:i]
	}
	return host
}

// writeStorefrontError maps catalog and transport failures onto public-safe
// responses. Unknown host, inactive domain, and inactive store all collapse into
// one generic 404 so a customer cannot tell an unregistered domain from a
// suspended store, and no moderation detail is disclosed.
func writeStorefrontError(w http.ResponseWriter, err error) {
	// A malformed browse parameter is caught locally during parsing, before any
	// Core call. It is a client error, not a Core failure.
	if errors.Is(err, errInvalidQuery) {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "invalid request parameters")
		return
	}

	var coreErr *coreclient.Error
	if errors.As(err, &coreErr) {
		switch coreErr.Code {
		case coreclient.CodeStorefrontUnavailable:
			httpx.WriteError(w, http.StatusNotFound, "storefront_unavailable", "storefront not available")
		case coreclient.CodeNotFound:
			httpx.WriteError(w, http.StatusNotFound, "not_found", "resource not found")
		case coreclient.CodeValidationError, coreclient.CodeInvalidArgument:
			httpx.WriteError(w, http.StatusBadRequest, "validation_error", "invalid request parameters")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "internal error")
		}
		return
	}

	// Core unreachable, timed out, or answered with something unusable.
	if errors.Is(err, coreclient.ErrUnavailable) || errors.Is(err, context.DeadlineExceeded) {
		httpx.WriteError(w, http.StatusServiceUnavailable, "service_unavailable", "service temporarily unavailable")
		return
	}
	httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "internal error")
}

func (deps Dependencies) handleStore(w http.ResponseWriter, r *http.Request) {
	bootstrap, err := deps.Catalog.StorefrontStore(r.Context(), deps.hostFor(r), i18n.FromContext(r.Context()))
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, StoreResponse{Store: bootstrap})
}

func (deps Dependencies) handleCategories(w http.ResponseWriter, r *http.Request) {
	items, err := deps.Catalog.StorefrontCategories(r.Context(), deps.hostFor(r), i18n.FromContext(r.Context()))
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, CategoryCollectionResponse{Items: items})
}

func (deps Dependencies) handleCategory(w http.ResponseWriter, r *http.Request) {
	category, err := deps.Catalog.StorefrontCategory(r.Context(), deps.hostFor(r), chi.URLParam(r, "slug"), i18n.FromContext(r.Context()))
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, CategoryResponse{Category: category})
}

func (deps Dependencies) handleProducts(w http.ResponseWriter, r *http.Request) {
	query, err := parseProductQuery(r)
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	page, err := deps.Catalog.StorefrontProducts(r.Context(), deps.hostFor(r), query, i18n.FromContext(r.Context()))
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, newProductCollectionResponse(page))
}

func (deps Dependencies) handleProduct(w http.ResponseWriter, r *http.Request) {
	product, err := deps.Catalog.StorefrontProduct(r.Context(), deps.hostFor(r), chi.URLParam(r, "slug"), i18n.FromContext(r.Context()))
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ProductResponse{Product: product})
}

func (deps Dependencies) handleSearch(w http.ResponseWriter, r *http.Request) {
	query, err := parseProductQuery(r)
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	page, err := deps.Catalog.StorefrontSearch(r.Context(), deps.hostFor(r), query, i18n.FromContext(r.Context()))
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, newProductCollectionResponse(page))
}

// parseProductQuery validates public browse parameters before they are forwarded
// to Core. Malformed values are rejected rather than silently defaulted, so a
// customer never receives a page they did not ask for. Bounds, sort names, and
// availability values are enforced by Core's read model.
func parseProductQuery(r *http.Request) (coreclient.ProductQuery, error) {
	params := r.URL.Query()
	query := coreclient.ProductQuery{
		CategorySlug: strings.TrimSpace(params.Get("category")),
		Keyword:      strings.TrimSpace(params.Get("q")),
		Availability: strings.TrimSpace(params.Get("availability")),
		Sort:         strings.TrimSpace(params.Get("sort")),
	}

	limit, err := intParam(params.Get("limit"), "limit")
	if err != nil {
		return coreclient.ProductQuery{}, err
	}
	offset, err := intParam(params.Get("offset"), "offset")
	if err != nil {
		return coreclient.ProductQuery{}, err
	}
	query.Limit, query.Offset = limit, offset

	if query.MinPriceMinor, err = intParam(params.Get("min_price"), "min_price"); err != nil {
		return coreclient.ProductQuery{}, err
	}
	if query.MaxPriceMinor, err = intParam(params.Get("max_price"), "max_price"); err != nil {
		return coreclient.ProductQuery{}, err
	}

	return query, nil
}

func intParam(raw, name string) (*int64, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("%w: %s must be an integer", errInvalidQuery, name)
	}
	return &value, nil
}
