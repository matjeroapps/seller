// Package storefrontapi hosts the public, anonymous HTTP surface of the native
// storefront.
//
// Tenant identity is derived exclusively from the trusted request host. The
// resolved host is forwarded to Core, which resolves the store and applies the
// catalog scope; the catalog read model itself is a Core-owned business
// capability reached over HTTP (ADR-017). Client-supplied store or seller
// identifiers are never read on these routes.
//
// Public reads may be served from a Seller-owned payload cache. The cache is an
// optimization layered on top of that boundary, never a substitute for it: every
// hit is validated against the authoritative cache generation Core reports for
// the resolved host, so a store that stopped resolving publicly stops being
// served and a payload whose generation was superseded is never returned.
package storefrontapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"


	"github.com/matjeroapps/seller/internal/config"
	"github.com/matjeroapps/seller/internal/coreclient"
	"github.com/matjeroapps/seller/internal/httpx"
	"github.com/matjeroapps/seller/internal/i18n"
	"github.com/matjeroapps/seller/internal/storefrontcache"
)

// errInvalidQuery means the caller supplied an unusable filter, sort, or page.
// It is raised locally during request parsing; Core enforces the rest.
var errInvalidQuery = errors.New("invalid catalog query")

const maxPreviewTokenBytes = 4096

// CatalogReader is the public catalog read model. *coreclient.Client satisfies
// it; the interface exists so handlers can be tested against a stub Core server
// without any database.
//
// Every read returns the cache generation Core labelled its payload with. It is 0
// when the response carried no label, which is what keeps an unlabelled response
// out of the cache instead of being stored under a fabricated generation.
type CatalogReader interface {
	StorefrontStore(ctx context.Context, host string, locale i18n.Locale) (coreclient.StoreBootstrap, int64, error)
	StorefrontStorePreview(ctx context.Context, host, previewToken string, locale i18n.Locale) (coreclient.StoreBootstrap, error)
	StorefrontCategories(ctx context.Context, host string, locale i18n.Locale) ([]coreclient.CategoryNode, int64, error)
	StorefrontCategory(ctx context.Context, host, slug string, locale i18n.Locale) (coreclient.CategoryNode, int64, error)
	StorefrontProducts(ctx context.Context, host string, query coreclient.ProductQuery, locale i18n.Locale) (coreclient.ProductPage, int64, error)
	StorefrontProduct(ctx context.Context, host, slug string, locale i18n.Locale) (coreclient.ProductDetail, int64, error)
	StorefrontSearch(ctx context.Context, host string, query coreclient.ProductQuery, locale i18n.Locale) (coreclient.ProductPage, int64, error)
}

// RevisionProbe reads the authoritative public cache generation of a trusted
// host. *coreclient.Client satisfies it.
type RevisionProbe interface {
	StorefrontRevision(ctx context.Context, host string) (int64, error)
}

// PayloadCache stores encoded public payloads. *storefrontcache.Cache satisfies
// it.
type PayloadCache interface {
	Lookup(ctx context.Context, id storefrontcache.Identity, revision int64) ([]byte, bool)
	Save(ctx context.Context, id storefrontcache.Identity, revision int64, body []byte)
}

// CommerceClient handles public cart, checkout, and guest order capabilities over HTTP to Core.
// *coreclient.Client satisfies it.
type CommerceClient interface {
	CreateCart(ctx context.Context, host string) (coreclient.CartResponse, error)
	GetCart(ctx context.Context, host, cartToken string) (coreclient.CartResponse, error)
	AddCartItem(ctx context.Context, host, cartToken, skuID string, quantity int64) (coreclient.CartResponse, error)
	UpdateCartItem(ctx context.Context, host, cartToken, itemID string, quantity int64) (coreclient.CartResponse, error)
	RemoveCartItem(ctx context.Context, host, cartToken, itemID string) (coreclient.CartResponse, error)
	CreateCheckoutSession(ctx context.Context, host, cartToken string) (coreclient.CheckoutSessionResponse, error)
	FinalizeCheckoutSession(ctx context.Context, host, sessionID string, request coreclient.FinalizeRequest) (coreclient.PublicOrder, error)
	GetGuestOrder(ctx context.Context, host, orderID, rawGuestToken string) (coreclient.PublicOrder, error)
	CancelGuestOrder(ctx context.Context, host, orderID, rawGuestToken string) (coreclient.PublicOrder, error)
}

// Dependencies wires the public catalog routes. Config supplies the trusted
// forwarded-host policy established in P4.1; host parsing is not reimplemented
// here.
type Dependencies struct {
	Catalog  CatalogReader
	Commerce CommerceClient
	Platform config.Config
	// Cache stores public payloads. Nil disables caching entirely, which is the
	// default: the storefront must never require Redis to serve a request.
	Cache PayloadCache
	// Revisions is the authoritative generation probe. Caching is only active
	// when it is present, because a cached payload that cannot be validated
	// against Core must never be served.
	Revisions RevisionProbe
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

		r.Post("/storefront/carts", deps.handleCreateCart)
		r.Get("/storefront/carts", deps.handleGetCart)
		r.Post("/storefront/carts/items", deps.handleAddCartItem)
		r.Patch("/storefront/carts/items/{itemID}", deps.handleUpdateCartItem)
		r.Delete("/storefront/carts/items/{itemID}", deps.handleRemoveCartItem)
		r.Post("/storefront/checkout/sessions", deps.handleCreateCheckoutSession)
		r.Post("/storefront/checkout/sessions/{sessionID}/finalize", deps.handleFinalizeCheckoutSession)
		r.Get("/storefront/orders/{orderID}", deps.handleGetGuestOrder)
		r.Post("/storefront/orders/{orderID}/cancel", deps.handleCancelGuestOrder)
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
		case coreclient.CodePreviewUnavailable:
			httpx.WriteError(w, http.StatusServiceUnavailable, "preview_unavailable", "preview unavailable")
		case coreclient.CodeUnavailable:
			httpx.WriteError(w, http.StatusServiceUnavailable, "service_unavailable", "service temporarily unavailable")
		case coreclient.CodeNotFound:
			httpx.WriteError(w, http.StatusNotFound, "not_found", "resource not found")
		case coreclient.CodeValidationError, coreclient.CodeInvalidArgument, coreclient.CodeSchemaMismatch, coreclient.CodeUnsafeContent:
			httpx.WriteError(w, http.StatusBadRequest, "validation_error", "invalid request parameters")
		case coreclient.CodeUnauthorized:
			httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "unauthorized")
		case coreclient.CodeForbidden:
			httpx.WriteError(w, http.StatusForbidden, "forbidden", "forbidden")
		case coreclient.CodeMarketMismatch:
			httpx.WriteError(w, http.StatusConflict, "market_mismatch", "market mismatch")
		case coreclient.CodeInsufficientInventory:
			httpx.WriteError(w, http.StatusConflict, "insufficient_inventory", "insufficient inventory")
		case coreclient.CodePriceChanged:
			httpx.WriteError(w, http.StatusConflict, "price_changed", "price changed")
		case coreclient.CodeListingUnavailable:
			httpx.WriteError(w, http.StatusConflict, "listing_unavailable", "listing unavailable")
		case coreclient.CodeCheckoutExpired:
			httpx.WriteError(w, http.StatusConflict, "checkout_expired", "checkout session expired")
		case coreclient.CodeIdempotencyConflict:
			httpx.WriteError(w, http.StatusConflict, "idempotency_conflict", "idempotency conflict")
		case coreclient.CodeInvalidOrderTransition:
			httpx.WriteError(w, http.StatusConflict, "invalid_order_transition", "invalid order transition")
		case coreclient.CodeConflict:
			httpx.WriteError(w, http.StatusConflict, "conflict", "conflict")
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

// cachingActive reports whether a request may be served from cache.
//
// Both a cache and a revision probe are required. Without the probe there is no
// way to tell whether a cached payload is still current or whether the store
// still resolves publicly, and serving it anyway would be exactly the stale-read
// this design exists to prevent.
func (deps Dependencies) cachingActive() bool {
	return deps.Cache != nil && deps.Revisions != nil
}

// serve performs one public storefront read, using the cache when it is active.
//
// read returns the public payload and the cache generation Core labelled it with.
// The payload is always encoded through the same encoder that writes it, so a
// response served from cache is byte-identical to the response that produced it.
//
// On a hit the authoritative generation is probed first, so a store that stopped
// resolving publicly fails here exactly as an uncached read would, and a payload
// from a superseded generation is unreachable rather than merely unpreferred.
//
// On a miss the payload is stored under the generation returned with it, never
// under the probed one. When a write commits between the probe and the read, the
// response carries the newer generation; storing it there both keeps the older
// namespace free of newer data and makes the entry immediately reachable to the
// next request, which probes that same newer generation. No retry and no lock is
// involved.
func (deps Dependencies) serve(w http.ResponseWriter, r *http.Request, id storefrontcache.Identity, read func() (any, int64, error)) {
	if !deps.cachingActive() {
		payload, _, err := read()
		if err != nil {
			writeStorefrontError(w, err)
			return
		}
		deps.writeJSON(w, payload)
		return
	}

	probed, err := deps.Revisions.StorefrontRevision(r.Context(), id.Host)
	if err != nil {
		// The probe fails the same way a public read does. Core being unreachable
		// therefore yields the existing generic 503 and an unresolvable host the
		// existing generic 404, and neither serves cached content.
		writeStorefrontError(w, err)
		return
	}

	if cached, found := deps.Cache.Lookup(r.Context(), id, probed); found {
		httpx.WriteEncodedJSON(w, http.StatusOK, cached)
		return
	}

	payload, revision, err := read()
	if err != nil {
		writeStorefrontError(w, err)
		return
	}

	encoded, err := httpx.EncodeJSON(payload)
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	deps.Cache.Save(r.Context(), id, revision, encoded)
	httpx.WriteEncodedJSON(w, http.StatusOK, encoded)
}

// writeJSON writes an uncached response through the same encoder a cached
// response is replayed with, so enabling the cache cannot change a byte of the
// public contract.
func (deps Dependencies) writeJSON(w http.ResponseWriter, payload any) {
	encoded, err := httpx.EncodeJSON(payload)
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	httpx.WriteEncodedJSON(w, http.StatusOK, encoded)
}

// identityFor builds the cache identity of a request.
//
// Host is the trusted host this service derived itself, never a client-supplied
// value, and locale is the negotiated locale. Together with the resource, the
// slug and the validated query they are the whole of what distinguishes one
// cached payload from another.
func (deps Dependencies) identityFor(r *http.Request, resource, slug string, query *coreclient.ProductQuery) storefrontcache.Identity {
	return storefrontcache.Identity{
		Host:     deps.hostFor(r),
		Locale:   i18n.FromContext(r.Context()),
		Resource: resource,
		Slug:     slug,
		Query:    query,
	}
}

func (deps Dependencies) handleStore(w http.ResponseWriter, r *http.Request) {
	previewToken := strings.TrimSpace(r.Header.Get(coreclient.HeaderStorefrontPreview))
	if previewToken != "" {
		if len(previewToken) > maxPreviewTokenBytes {
			httpx.WriteError(w, http.StatusBadRequest, "validation_error", "preview token exceeds maximum allowed size")
			return
		}
		host := deps.hostFor(r)
		locale := i18n.FromContext(r.Context())
		bootstrap, err := deps.Catalog.StorefrontStorePreview(r.Context(), host, previewToken, locale)
		if err != nil {
			writeStorefrontError(w, err)
			return
		}
		w.Header().Set("Cache-Control", "private, no-store")
		w.Header().Set("Pragma", "no-cache")
		deps.writeJSON(w, StoreResponse{Store: bootstrap})
		return
	}

	id := deps.identityFor(r, storefrontcache.ResourceStore, "", nil)
	deps.serve(w, r, id, func() (any, int64, error) {
		bootstrap, revision, err := deps.Catalog.StorefrontStore(r.Context(), id.Host, id.Locale)
		return StoreResponse{Store: bootstrap}, revision, err
	})
}

func (deps Dependencies) handleCategories(w http.ResponseWriter, r *http.Request) {
	id := deps.identityFor(r, storefrontcache.ResourceCategories, "", nil)
	deps.serve(w, r, id, func() (any, int64, error) {
		items, revision, err := deps.Catalog.StorefrontCategories(r.Context(), id.Host, id.Locale)
		return CategoryCollectionResponse{Items: items}, revision, err
	})
}

func (deps Dependencies) handleCategory(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	id := deps.identityFor(r, storefrontcache.ResourceCategory, slug, nil)
	deps.serve(w, r, id, func() (any, int64, error) {
		category, revision, err := deps.Catalog.StorefrontCategory(r.Context(), id.Host, slug, id.Locale)
		return CategoryResponse{Category: category}, revision, err
	})
}

func (deps Dependencies) handleProducts(w http.ResponseWriter, r *http.Request) {
	query, err := parseProductQuery(r)
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	id := deps.identityFor(r, storefrontcache.ResourceProducts, "", &query)
	deps.serve(w, r, id, func() (any, int64, error) {
		page, revision, err := deps.Catalog.StorefrontProducts(r.Context(), id.Host, query, id.Locale)
		return newProductCollectionResponse(page), revision, err
	})
}

func (deps Dependencies) handleProduct(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	id := deps.identityFor(r, storefrontcache.ResourceProduct, slug, nil)
	deps.serve(w, r, id, func() (any, int64, error) {
		product, revision, err := deps.Catalog.StorefrontProduct(r.Context(), id.Host, slug, id.Locale)
		return ProductResponse{Product: product}, revision, err
	})
}

func (deps Dependencies) handleSearch(w http.ResponseWriter, r *http.Request) {
	query, err := parseProductQuery(r)
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	id := deps.identityFor(r, storefrontcache.ResourceSearch, "", &query)
	deps.serve(w, r, id, func() (any, int64, error) {
		page, revision, err := deps.Catalog.StorefrontSearch(r.Context(), id.Host, query, id.Locale)
		return newProductCollectionResponse(page), revision, err
	})
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

func (deps Dependencies) setCookie(w http.ResponseWriter, name, value string, maxAge int) {
	cookie := &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		HttpOnly: true,
		Secure:   deps.Platform.StorefrontCookieSecure,
		SameSite: http.SameSiteLaxMode,
	}
	if maxAge < 0 {
		cookie.MaxAge = -1
		cookie.Expires = time.Unix(0, 0)
	} else if maxAge > 0 {
		cookie.MaxAge = maxAge
	}
	http.SetCookie(w, cookie)
}

func getCookieValue(r *http.Request, name string) string {
	c, err := r.Cookie(name)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(c.Value)
}

func (deps Dependencies) handleCreateCart(w http.ResponseWriter, r *http.Request) {
	if !deps.Platform.StorefrontCheckoutEnabled {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	host := deps.hostFor(r)
	cartToken := getCookieValue(r, "matjero_cart")
	if cartToken != "" {
		cart, err := deps.Commerce.GetCart(r.Context(), host, cartToken)
		if err == nil && cart.Status == "active" {
			cart.CartToken = ""
			w.Header().Set("Cache-Control", "private, no-store")
			deps.writeJSON(w, cart)
			return
		}
	}
	cart, err := deps.Commerce.CreateCart(r.Context(), host)
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	deps.setCookie(w, "matjero_cart", cart.CartToken, 30*24*3600)
	cart.CartToken = ""
	w.Header().Set("Cache-Control", "private, no-store")
	deps.writeJSON(w, cart)
}

func (deps Dependencies) handleGetCart(w http.ResponseWriter, r *http.Request) {
	if !deps.Platform.StorefrontCheckoutEnabled {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	host := deps.hostFor(r)
	cartToken := getCookieValue(r, "matjero_cart")
	if cartToken == "" {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "unauthorized")
		return
	}
	cart, err := deps.Commerce.GetCart(r.Context(), host, cartToken)
	if err != nil {
		var coreErr *coreclient.Error
		if errors.As(err, &coreErr) && coreErr.Code == coreclient.CodeConflict {
			deps.setCookie(w, "matjero_cart", "", -1)
			httpx.WriteError(w, http.StatusConflict, "cart_expired", "cart expired")
			return
		}
		writeStorefrontError(w, err)
		return
	}
	cart.CartToken = ""
	w.Header().Set("Cache-Control", "private, no-store")
	deps.writeJSON(w, cart)
}

func (deps Dependencies) handleAddCartItem(w http.ResponseWriter, r *http.Request) {
	if !deps.Platform.StorefrontCheckoutEnabled {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	var body struct {
		SKUID    string `json:"sku_id"`
		Quantity int64  `json:"quantity"`
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_argument", "invalid request parameters")
		return
	}
	host := deps.hostFor(r)
	cartToken := getCookieValue(r, "matjero_cart")
	if cartToken == "" {
		cart, err := deps.Commerce.CreateCart(r.Context(), host)
		if err != nil {
			writeStorefrontError(w, err)
			return
		}
		cartToken = cart.CartToken
		deps.setCookie(w, "matjero_cart", cartToken, 30*24*3600)
	}
	cart, err := deps.Commerce.AddCartItem(r.Context(), host, cartToken, body.SKUID, body.Quantity)
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	cart.CartToken = ""
	w.Header().Set("Cache-Control", "private, no-store")
	deps.writeJSON(w, cart)
}

func (deps Dependencies) handleUpdateCartItem(w http.ResponseWriter, r *http.Request) {
	if !deps.Platform.StorefrontCheckoutEnabled {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	var body struct {
		Quantity int64 `json:"quantity"`
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_argument", "invalid request parameters")
		return
	}
	host := deps.hostFor(r)
	cartToken := getCookieValue(r, "matjero_cart")
	if cartToken == "" {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "unauthorized")
		return
	}
	itemID := chi.URLParam(r, "itemID")
	cart, err := deps.Commerce.UpdateCartItem(r.Context(), host, cartToken, itemID, body.Quantity)
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	cart.CartToken = ""
	w.Header().Set("Cache-Control", "private, no-store")
	deps.writeJSON(w, cart)
}

func (deps Dependencies) handleRemoveCartItem(w http.ResponseWriter, r *http.Request) {
	if !deps.Platform.StorefrontCheckoutEnabled {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	host := deps.hostFor(r)
	cartToken := getCookieValue(r, "matjero_cart")
	if cartToken == "" {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "unauthorized")
		return
	}
	itemID := chi.URLParam(r, "itemID")
	cart, err := deps.Commerce.RemoveCartItem(r.Context(), host, cartToken, itemID)
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	cart.CartToken = ""
	w.Header().Set("Cache-Control", "private, no-store")
	deps.writeJSON(w, cart)
}

func (deps Dependencies) handleCreateCheckoutSession(w http.ResponseWriter, r *http.Request) {
	if !deps.Platform.StorefrontCheckoutEnabled {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	host := deps.hostFor(r)
	cartToken := getCookieValue(r, "matjero_cart")
	if cartToken == "" {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "active cart required for checkout session")
		return
	}
	session, err := deps.Commerce.CreateCheckoutSession(r.Context(), host, cartToken)
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	deps.setCookie(w, "matjero_guest_session_"+session.ID, session.GuestOrderAccessToken, 3600)
	session.GuestOrderAccessToken = ""
	w.Header().Set("Cache-Control", "private, no-store")
	httpx.WriteJSON(w, http.StatusCreated, session)
}

func (deps Dependencies) handleFinalizeCheckoutSession(w http.ResponseWriter, r *http.Request) {
	if !deps.Platform.StorefrontCheckoutEnabled {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	sessionID := chi.URLParam(r, "sessionID")
	rawGuestToken := getCookieValue(r, "matjero_guest_session_"+sessionID)
	if rawGuestToken == "" {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "guest checkout capability required")
		return
	}
	var req coreclient.FinalizeRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "invalid checkout payload")
		return
	}
	host := deps.hostFor(r)
	order, err := deps.Commerce.FinalizeCheckoutSession(r.Context(), host, sessionID, req)
	if err != nil {
		writeStorefrontError(w, err)
		return
	}

	deps.setCookie(w, "matjero_guest_order_"+order.ID, rawGuestToken, 30*24*3600)
	deps.setCookie(w, "matjero_guest_session_"+sessionID, "", -1)

	w.Header().Set("Cache-Control", "private, no-store")
	deps.writeJSON(w, ToOrderResponse(order))
}

func (deps Dependencies) handleGetGuestOrder(w http.ResponseWriter, r *http.Request) {
	if !deps.Platform.StorefrontCheckoutEnabled {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	orderID := chi.URLParam(r, "orderID")
	rawGuestToken := getCookieValue(r, "matjero_guest_order_"+orderID)
	if rawGuestToken == "" {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "guest order capability required")
		return
	}
	host := deps.hostFor(r)
	order, err := deps.Commerce.GetGuestOrder(r.Context(), host, orderID, rawGuestToken)
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	deps.writeJSON(w, ToOrderResponse(order))
}

func (deps Dependencies) handleCancelGuestOrder(w http.ResponseWriter, r *http.Request) {
	if !deps.Platform.StorefrontCheckoutEnabled {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	orderID := chi.URLParam(r, "orderID")
	rawGuestToken := getCookieValue(r, "matjero_guest_order_"+orderID)
	if rawGuestToken == "" {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "guest order capability required")
		return
	}
	host := deps.hostFor(r)
	order, err := deps.Commerce.CancelGuestOrder(r.Context(), host, orderID, rawGuestToken)
	if err != nil {
		writeStorefrontError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	deps.writeJSON(w, ToOrderResponse(order))
}

