// Package storefrontapi hosts the public, anonymous HTTP surface of the native
// storefront.
//
// Tenant identity is derived exclusively from the trusted request host: the
// resolved store is fed into a Core storefront.CatalogScope, which is the only
// way to query the public catalog read model. Client-supplied store or seller
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

	"github.com/matjeroapps/core/packages/config"
	"github.com/matjeroapps/core/packages/httpx"
	"github.com/matjeroapps/core/packages/i18n"
	"github.com/matjeroapps/core/pkg/storefront"
)

// CatalogReader is the Core public catalog read model. storefront.CatalogRepository
// satisfies it; the interface exists so handlers can be tested without a database.
type CatalogReader interface {
	Bootstrap(ctx context.Context, scope storefront.CatalogScope) (storefront.StoreBootstrap, error)
	Categories(ctx context.Context, scope storefront.CatalogScope) ([]storefront.CategoryNode, error)
	CategoryBySlug(ctx context.Context, scope storefront.CatalogScope, slug string) (storefront.CategoryNode, error)
	Products(ctx context.Context, scope storefront.CatalogScope, query storefront.ProductQuery) (storefront.ProductPage, error)
	Search(ctx context.Context, scope storefront.CatalogScope, keyword string, query storefront.ProductQuery) (storefront.ProductPage, error)
	ProductBySlug(ctx context.Context, scope storefront.CatalogScope, slug string) (storefront.ProductDetail, error)
}

// StoreLocator maps a trusted domain to a tenant store. storefront.StoreResolver
// satisfies it.
type StoreLocator interface {
	Resolve(ctx context.Context, domain string) (storefront.ResolvedStore, error)
}

// Dependencies wires the public catalog routes. Config supplies the trusted
// forwarded-host policy established in P4.1; host parsing is not reimplemented here.
type Dependencies struct {
	Catalog  CatalogReader
	Stores   StoreLocator
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

// scopeFor resolves the tenant from the trusted request host and binds it to the
// negotiated locale. Query parameters and headers naming a store or seller are
// never consulted, so they cannot override the host tenant.
func (deps Dependencies) scopeFor(w http.ResponseWriter, r *http.Request) (storefront.CatalogScope, bool) {
	domain := storefront.DomainFromRequest(r, deps.Platform)
	resolved, err := deps.Stores.Resolve(r.Context(), domain)
	if err != nil {
		writeStorefrontError(w, err)
		return storefront.CatalogScope{}, false
	}
	scope, err := storefront.NewCatalogScope(resolved, i18n.FromContext(r.Context()))
	if err != nil {
		writeStorefrontError(w, err)
		return storefront.CatalogScope{}, false
	}
	return scope, true
}

// writeStorefrontError maps read-model and resolution failures onto public-safe
// responses. Unknown host, inactive domain, and inactive store all collapse into
// one generic 404 so a customer cannot tell an unregistered domain from a
// suspended store, and no moderation detail is disclosed.
func writeStorefrontError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, storefront.ErrStoreNotFound),
		errors.Is(err, storefront.ErrDomainInactive),
		errors.Is(err, storefront.ErrStoreInactive):
		httpx.WriteError(w, http.StatusNotFound, "storefront_unavailable", "storefront not available")
	case errors.Is(err, storefront.ErrCatalogNotFound):
		httpx.WriteError(w, http.StatusNotFound, "not_found", "resource not found")
	case errors.Is(err, storefront.ErrInvalidQuery):
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "invalid request parameters")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "internal error")
	}
}

func (deps Dependencies) handleStore(w http.ResponseWriter, r *http.Request) {
	scope, ok := deps.scopeFor(w, r)
	if !ok {
		return
	}
	bootstrap, err := deps.Catalog.Bootstrap(r.Context(), scope)
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, StoreResponse{Store: bootstrap})
}

func (deps Dependencies) handleCategories(w http.ResponseWriter, r *http.Request) {
	scope, ok := deps.scopeFor(w, r)
	if !ok {
		return
	}
	items, err := deps.Catalog.Categories(r.Context(), scope)
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, CategoryCollectionResponse{Items: items})
}

func (deps Dependencies) handleCategory(w http.ResponseWriter, r *http.Request) {
	scope, ok := deps.scopeFor(w, r)
	if !ok {
		return
	}
	category, err := deps.Catalog.CategoryBySlug(r.Context(), scope, chi.URLParam(r, "slug"))
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, CategoryResponse{Category: category})
}

func (deps Dependencies) handleProducts(w http.ResponseWriter, r *http.Request) {
	scope, ok := deps.scopeFor(w, r)
	if !ok {
		return
	}
	query, err := parseProductQuery(r)
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	page, err := deps.Catalog.Products(r.Context(), scope, query)
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, newProductCollectionResponse(page))
}

func (deps Dependencies) handleProduct(w http.ResponseWriter, r *http.Request) {
	scope, ok := deps.scopeFor(w, r)
	if !ok {
		return
	}
	product, err := deps.Catalog.ProductBySlug(r.Context(), scope, chi.URLParam(r, "slug"))
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ProductResponse{Product: product})
}

func (deps Dependencies) handleSearch(w http.ResponseWriter, r *http.Request) {
	scope, ok := deps.scopeFor(w, r)
	if !ok {
		return
	}
	query, err := parseProductQuery(r)
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	page, err := deps.Catalog.Search(r.Context(), scope, query.Keyword, query)
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, newProductCollectionResponse(page))
}

// parseProductQuery validates public browse parameters before they reach the read
// model. Malformed values are rejected rather than silently defaulted, so a
// customer never receives a page they did not ask for. Bounds, sort names, and
// availability values are enforced by the Core read model.
func parseProductQuery(r *http.Request) (storefront.ProductQuery, error) {
	params := r.URL.Query()
	query := storefront.ProductQuery{
		CategorySlug: strings.TrimSpace(params.Get("category")),
		Keyword:      strings.TrimSpace(params.Get("q")),
		Availability: strings.TrimSpace(params.Get("availability")),
		Sort:         strings.TrimSpace(params.Get("sort")),
	}

	limit, err := intParam(params.Get("limit"), "limit")
	if err != nil {
		return storefront.ProductQuery{}, err
	}
	offset, err := intParam(params.Get("offset"), "offset")
	if err != nil {
		return storefront.ProductQuery{}, err
	}
	if limit != nil {
		query.Page.Limit = int(*limit)
	}
	if offset != nil {
		query.Page.Offset = int(*offset)
	}

	if query.MinPriceMinor, err = intParam(params.Get("min_price"), "min_price"); err != nil {
		return storefront.ProductQuery{}, err
	}
	if query.MaxPriceMinor, err = intParam(params.Get("max_price"), "max_price"); err != nil {
		return storefront.ProductQuery{}, err
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
		return nil, fmt.Errorf("%w: %s must be an integer", storefront.ErrInvalidQuery, name)
	}
	return &value, nil
}
