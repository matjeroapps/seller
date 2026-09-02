package storefrontapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/matjeroapps/seller/internal/config"
	"github.com/matjeroapps/seller/internal/coreclient"
	"github.com/matjeroapps/seller/internal/i18n"
	"github.com/matjeroapps/seller/internal/money"
	"github.com/matjeroapps/seller/internal/storefrontcache"
)

// These tests prove the Seller storefront's transport and BFF behaviour against a
// local stub Core server. They need no PostgreSQL, no Core migrations and no Core
// module: business correctness is Core's own responsibility and is tested there.

const (
	domainA = "store-a.matjero.test"
	domainB = "store-b.matjero.test"

	// The supplier wholesale cost is internal. No public payload may contain it.
	wholesaleMinor = 10000
	// Each store sets its own public listing price.
	storeAPrice = 15000
	storeBPrice = 19900
)

// stubCatalog is a local stand-in for the Core catalog read model.
type stubCatalog struct {
	// host records the host the handler forwarded, which is the tenant authority.
	host string
	// locale records the negotiated locale the handler forwarded.
	locale i18n.Locale
	// query records the forwarded browse query.
	query coreclient.ProductQuery
	// previewToken records the preview token forwarded.
	previewToken string

	err error

	store      coreclient.StoreBootstrap
	categories []coreclient.CategoryNode
	category   coreclient.CategoryNode
	page       coreclient.ProductPage
	product    coreclient.ProductDetail
}

func (s *stubCatalog) StorefrontStore(ctx context.Context, host string, locale i18n.Locale) (coreclient.StoreBootstrap, int64, error) {
	s.host, s.locale = host, locale
	return s.store, 1, s.err
}

func (s *stubCatalog) StorefrontStorePreview(ctx context.Context, host, previewToken string, locale i18n.Locale) (coreclient.StoreBootstrap, error) {
	s.host, s.previewToken, s.locale = host, previewToken, locale
	return s.store, s.err
}

func (s *stubCatalog) StorefrontCategories(ctx context.Context, host string, locale i18n.Locale) ([]coreclient.CategoryNode, int64, error) {
	s.host, s.locale = host, locale
	return s.categories, 1, s.err
}

func (s *stubCatalog) StorefrontCategory(ctx context.Context, host, slug string, locale i18n.Locale) (coreclient.CategoryNode, int64, error) {
	s.host, s.locale = host, locale
	return s.category, 1, s.err
}

func (s *stubCatalog) StorefrontProducts(ctx context.Context, host string, query coreclient.ProductQuery, locale i18n.Locale) (coreclient.ProductPage, int64, error) {
	s.host, s.locale, s.query = host, locale, query
	return s.page, 1, s.err
}

func (s *stubCatalog) StorefrontProduct(ctx context.Context, host, slug string, locale i18n.Locale) (coreclient.ProductDetail, int64, error) {
	s.host, s.locale = host, locale
	return s.product, 1, s.err
}

func (s *stubCatalog) StorefrontSearch(ctx context.Context, host string, query coreclient.ProductQuery, locale i18n.Locale) (coreclient.ProductPage, int64, error) {
	s.host, s.locale, s.query = host, locale, query
	return s.page, 1, s.err
}

func newHandler(catalog CatalogReader, platform config.Config) http.Handler {
	router := chi.NewRouter()
	router.Use(i18n.Middleware(i18n.Default()))
	router.Route("/v1", func(r chi.Router) {
		RegisterStorefrontRoutes(Dependencies{Catalog: catalog, Platform: platform})(r)
	})
	return router
}

func doGet(t *testing.T, handler http.Handler, path, host string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if host != "" {
		req.Host = host
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func decodeError(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var payload struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode error envelope: %v (body %q)", err, rec.Body.String())
	}
	return payload.Error.Code
}

// --- host forwarding ---

func TestStorefrontForwardsTrustedHost(t *testing.T) {
	catalog := &stubCatalog{}
	handler := newHandler(catalog, config.Config{})

	doGet(t, handler, "/v1/storefront/store", domainA)

	if catalog.host != domainA {
		t.Fatalf("forwarded host = %q, want %q", catalog.host, domainA)
	}
}

func TestStorefrontNormalizesHost(t *testing.T) {
	catalog := &stubCatalog{}
	handler := newHandler(catalog, config.Config{})

	doGet(t, handler, "/v1/storefront/store", "Store-A.Matjero.TEST:8443")

	if catalog.host != "store-a.matjero.test" {
		t.Fatalf("forwarded host = %q, want the normalized host", catalog.host)
	}
}

// X-Forwarded-Host must be ignored unless the deployment explicitly trusts a
// reverse proxy, otherwise any client could impersonate another tenant.
func TestStorefrontIgnoresForwardedHostByDefault(t *testing.T) {
	catalog := &stubCatalog{}
	handler := newHandler(catalog, config.Config{})

	req := httptest.NewRequest(http.MethodGet, "/v1/storefront/store", nil)
	req.Host = domainA
	req.Header.Set("X-Forwarded-Host", domainB)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if catalog.host != domainA {
		t.Fatalf("forwarded host = %q, want the request Host %q", catalog.host, domainA)
	}
}

func TestStorefrontHonoursForwardedHostWhenTrusted(t *testing.T) {
	catalog := &stubCatalog{}
	handler := newHandler(catalog, config.Config{TrustedForwardedHost: true})

	req := httptest.NewRequest(http.MethodGet, "/v1/storefront/store", nil)
	req.Host = domainA
	req.Header.Set("X-Forwarded-Host", domainB+", evil.example.com")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if catalog.host != domainB {
		t.Fatalf("forwarded host = %q, want the first forwarded host %q", catalog.host, domainB)
	}
}

// A client-supplied store or seller identifier must never influence the tenant.
func TestStorefrontIgnoresClientSuppliedTenantIdentifiers(t *testing.T) {
	catalog := &stubCatalog{}
	handler := newHandler(catalog, config.Config{})

	doGet(t, handler, "/v1/storefront/store?store_id=other&seller_id=other", domainA)

	if catalog.host != domainA {
		t.Fatalf("forwarded host = %q, want %q; query parameters must not select a tenant", catalog.host, domainA)
	}
}

// --- locale mapping ---

func TestStorefrontForwardsNegotiatedLocale(t *testing.T) {
	catalog := &stubCatalog{}
	handler := newHandler(catalog, config.Config{})

	req := httptest.NewRequest(http.MethodGet, "/v1/storefront/store", nil)
	req.Host = domainA
	req.Header.Set("Accept-Language", "ar")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if catalog.locale != i18n.LocaleArabic {
		t.Fatalf("forwarded locale = %q, want %q", catalog.locale, i18n.LocaleArabic)
	}
}

func TestStorefrontDefaultsToEnglish(t *testing.T) {
	catalog := &stubCatalog{}
	handler := newHandler(catalog, config.Config{})

	doGet(t, handler, "/v1/storefront/store", domainA)

	if catalog.locale != i18n.LocaleEnglish {
		t.Fatalf("forwarded locale = %q, want %q", catalog.locale, i18n.LocaleEnglish)
	}
}

// --- query forwarding ---

func TestStorefrontForwardsBrowseQuery(t *testing.T) {
	catalog := &stubCatalog{}
	handler := newHandler(catalog, config.Config{})

	doGet(t, handler, "/v1/storefront/products?category=lighting&availability=in_stock&sort=price_asc&min_price=1000&max_price=9000&limit=12&offset=24", domainA)

	query := catalog.query
	if query.CategorySlug != "lighting" {
		t.Errorf("category = %q, want lighting", query.CategorySlug)
	}
	if query.Availability != "in_stock" {
		t.Errorf("availability = %q, want in_stock", query.Availability)
	}
	if query.Sort != "price_asc" {
		t.Errorf("sort = %q, want price_asc", query.Sort)
	}
	if query.MinPriceMinor == nil || *query.MinPriceMinor != 1000 {
		t.Errorf("min_price = %v, want 1000", query.MinPriceMinor)
	}
	if query.MaxPriceMinor == nil || *query.MaxPriceMinor != 9000 {
		t.Errorf("max_price = %v, want 9000", query.MaxPriceMinor)
	}
	if query.Limit == nil || *query.Limit != 12 {
		t.Errorf("limit = %v, want 12", query.Limit)
	}
	if query.Offset == nil || *query.Offset != 24 {
		t.Errorf("offset = %v, want 24", query.Offset)
	}
}

func TestStorefrontOmitsAbsentQueryValues(t *testing.T) {
	catalog := &stubCatalog{}
	handler := newHandler(catalog, config.Config{})

	doGet(t, handler, "/v1/storefront/products", domainA)

	query := catalog.query
	if query.Limit != nil || query.Offset != nil {
		t.Errorf("absent limit/offset must be omitted, got %v/%v", query.Limit, query.Offset)
	}
	if query.MinPriceMinor != nil || query.MaxPriceMinor != nil {
		t.Errorf("absent prices must be omitted, got %v/%v", query.MinPriceMinor, query.MaxPriceMinor)
	}
}

func TestStorefrontForwardsSearchKeyword(t *testing.T) {
	catalog := &stubCatalog{}
	handler := newHandler(catalog, config.Config{})

	doGet(t, handler, "/v1/storefront/search?q=lamp", domainA)

	if catalog.query.Keyword != "lamp" {
		t.Fatalf("keyword = %q, want lamp", catalog.query.Keyword)
	}
}

func TestStorefrontRejectsMalformedQuery(t *testing.T) {
	catalog := &stubCatalog{}
	handler := newHandler(catalog, config.Config{})

	for _, path := range []string{
		"/v1/storefront/products?limit=abc",
		"/v1/storefront/products?offset=xyz",
		"/v1/storefront/products?min_price=nope",
		"/v1/storefront/products?max_price=nope",
		"/v1/storefront/search?limit=abc",
	} {
		rec := doGet(t, handler, path, domainA)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status = %d, want 400 (body %q)", path, rec.Code, rec.Body.String())
		}
		if got := decodeError(t, rec); got != "validation_error" {
			t.Errorf("%s: error code = %q, want validation_error", path, got)
		}
	}
}

// --- response mapping ---

func TestStorefrontMapsProductPage(t *testing.T) {
	catalog := &stubCatalog{page: coreclient.ProductPage{
		Items:  []coreclient.ProductListItem{{Slug: "lamp", Name: "Desk Lamp"}},
		Total:  1,
		Limit:  24,
		Offset: 0,
	}}
	handler := newHandler(catalog, config.Config{})

	rec := doGet(t, handler, "/v1/storefront/products", domainA)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (body %q)", rec.Code, rec.Body.String())
	}

	var payload ProductCollectionResponse
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(payload.Items) != 1 || payload.Items[0].Slug != "lamp" {
		t.Errorf("items = %+v, want one lamp", payload.Items)
	}
	if payload.Pagination.Total != 1 || payload.Pagination.Limit != 24 {
		t.Errorf("pagination = %+v, want total 1 limit 24", payload.Pagination)
	}
}

// An empty page must serialize as an empty array, not null, so clients can
// iterate without a null check.
func TestStorefrontEmptyPageSerializesAsArray(t *testing.T) {
	catalog := &stubCatalog{page: coreclient.ProductPage{}}
	handler := newHandler(catalog, config.Config{})

	rec := doGet(t, handler, "/v1/storefront/products", domainA)
	body := rec.Body.String()

	if strings.Contains(body, `"items":null`) {
		t.Fatalf("empty page serialized items as null: %s", body)
	}
	if !strings.Contains(body, `"items":[]`) {
		t.Fatalf("expected an empty items array, got %s", body)
	}
}

// --- public error mapping ---

func TestStorefrontMapsCoreErrorsToPublicResponses(t *testing.T) {
	cases := []struct {
		name       string
		code       string
		wantStatus int
		wantCode   string
	}{
		{"unknown host", coreclient.CodeStorefrontUnavailable, http.StatusNotFound, "storefront_unavailable"},
		{"missing record", coreclient.CodeNotFound, http.StatusNotFound, "not_found"},
		{"invalid query", coreclient.CodeValidationError, http.StatusBadRequest, "validation_error"},
		{"invalid argument", coreclient.CodeInvalidArgument, http.StatusBadRequest, "validation_error"},
		{"core internal", coreclient.CodeInternalError, http.StatusInternalServerError, "internal_error"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			catalog := &stubCatalog{err: &coreclient.Error{Status: tc.wantStatus, Code: tc.code}}
			handler := newHandler(catalog, config.Config{})

			rec := doGet(t, handler, "/v1/storefront/store", domainA)

			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d (body %q)", rec.Code, tc.wantStatus, rec.Body.String())
			}
			if got := decodeError(t, rec); got != tc.wantCode {
				t.Errorf("error code = %q, want %q", got, tc.wantCode)
			}
		})
	}
}

// Unknown host, inactive domain and inactive store must be indistinguishable:
// all three arrive as the same Core code and collapse to one generic 404.
func TestStorefrontHostFailuresAreIndistinguishable(t *testing.T) {
	var bodies []string
	for range []int{1, 2, 3} {
		catalog := &stubCatalog{err: &coreclient.Error{Status: 404, Code: coreclient.CodeStorefrontUnavailable}}
		handler := newHandler(catalog, config.Config{})
		rec := doGet(t, handler, "/v1/storefront/store", "anything.matjero.test")
		bodies = append(bodies, rec.Body.String())
	}
	for i, body := range bodies {
		if body != bodies[0] {
			t.Errorf("response %d differs: %q vs %q", i, body, bodies[0])
		}
	}
}

// --- Core unavailable ---

func TestStorefrontReturns503WhenCoreUnavailable(t *testing.T) {
	catalog := &stubCatalog{err: coreclient.ErrUnavailable}
	handler := newHandler(catalog, config.Config{})

	rec := doGet(t, handler, "/v1/storefront/store", domainA)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503 (body %q)", rec.Code, rec.Body.String())
	}
	if got := decodeError(t, rec); got != "service_unavailable" {
		t.Errorf("error code = %q, want service_unavailable", got)
	}
	// The response must not leak the internal Core host or a transport detail.
	body := rec.Body.String()
	for _, leak := range []string{"connection refused", "core-api", "dial tcp", "no such host"} {
		if strings.Contains(body, leak) {
			t.Errorf("response leaked transport detail %q: %s", leak, body)
		}
	}
}

func TestStorefrontReturns503OnCoreTimeout(t *testing.T) {
	catalog := &stubCatalog{err: context.DeadlineExceeded}
	handler := newHandler(catalog, config.Config{})

	rec := doGet(t, handler, "/v1/storefront/store", domainA)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503 (body %q)", rec.Code, rec.Body.String())
	}
}

// --- public privacy contract ---

// The public payload must carry the seller's listing price and never the
// supplier's wholesale cost.
func TestStorefrontDisclosesListingPriceOnly(t *testing.T) {
	catalog := &stubCatalog{page: coreclient.ProductPage{
		Items: []coreclient.ProductListItem{{
			Slug:  "lamp",
			Name:  "Desk Lamp",
			Price: moneyOf(storeAPrice, "EGP"),
		}},
		Total: 1,
	}}
	handler := newHandler(catalog, config.Config{})

	rec := doGet(t, handler, "/v1/storefront/products", domainA)
	body := rec.Body.String()

	if !strings.Contains(body, `"amount_minor":15000`) {
		t.Errorf("public payload must carry the listing price: %s", body)
	}
	if strings.Contains(body, `"amount_minor":10000`) {
		t.Errorf("public payload leaked the supplier wholesale cost: %s", body)
	}
}

// Supplier identity must never appear in a public storefront payload.
func TestStorefrontHidesSupplierIdentity(t *testing.T) {
	catalog := &stubCatalog{product: coreclient.ProductDetail{
		Slug:  "lamp",
		Name:  "Desk Lamp",
		Price: moneyOf(storeAPrice, "EGP"),
	}}
	handler := newHandler(catalog, config.Config{})

	rec := doGet(t, handler, "/v1/storefront/products/lamp", domainA)
	body := rec.Body.String()

	for _, secret := range []string{"supplier", "wholesale", "cost"} {
		if strings.Contains(strings.ToLower(body), secret) {
			t.Errorf("public product payload leaked %q: %s", secret, body)
		}
	}
}

func moneyOf(minor int64, currency string) money.Money {
	return money.MustNew(minor, currency)
}

// --- Preview tests ---

type stubRevisionProbe struct {
	calls int
	rev   int64
	err   error
}

func (s *stubRevisionProbe) StorefrontRevision(ctx context.Context, host string) (int64, error) {
	s.calls++
	return s.rev, s.err
}

type stubCache struct {
	lookupCalls int
	saveCalls   int
	data        map[string][]byte
}

func (c *stubCache) Lookup(ctx context.Context, id storefrontcache.Identity, revision int64) ([]byte, bool) {
	c.lookupCalls++
	if c.data == nil {
		return nil, false
	}
	return nil, false
}

func (c *stubCache) Save(ctx context.Context, id storefrontcache.Identity, revision int64, body []byte) {
	c.saveCalls++
}

func TestStorefrontPreviewHandling(t *testing.T) {
	catalog := &stubCatalog{store: coreclient.StoreBootstrap{
		StoreCode: "store-a",
		StoreName: "Store A Draft",
		Theme: &coreclient.StoreTheme{
			Key:           "theme-a",
			Version:       "1.0.0",
			Configuration: map[string]any{"color": "red"},
		},
	}}
	handler := newHandler(catalog, config.Config{})

	req := httptest.NewRequest(http.MethodGet, "/v1/storefront/store", nil)
	req.Host = domainA
	req.Header.Set("X-Matjero-Storefront-Preview", "valid-preview-token")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
	}
	if catalog.previewToken != "valid-preview-token" {
		t.Fatalf("catalog previewToken = %q, want valid-preview-token", catalog.previewToken)
	}
	if cc := rec.Header().Get("Cache-Control"); !strings.Contains(cc, "private") || !strings.Contains(cc, "no-store") {
		t.Errorf("Cache-Control = %q, want private, no-store", cc)
	}
	if pragma := rec.Header().Get("Pragma"); pragma != "no-cache" {
		t.Errorf("Pragma = %q, want no-cache", pragma)
	}
}

func TestStorefrontPreviewCacheBypass(t *testing.T) {
	catalog := &stubCatalog{store: coreclient.StoreBootstrap{StoreCode: "store-a"}}
	revisions := &stubRevisionProbe{rev: 5}
	cache := &stubCache{}

	router := chi.NewRouter()
	router.Use(i18n.Middleware(i18n.Default()))
	router.Route("/v1", func(r chi.Router) {
		RegisterStorefrontRoutes(Dependencies{
			Catalog:   catalog,
			Revisions: revisions,
			Cache:     cache,
			Platform:  config.Config{},
		})(r)
	})

	req := httptest.NewRequest(http.MethodGet, "/v1/storefront/store", nil)
	req.Host = domainA
	req.Header.Set("X-Matjero-Storefront-Preview", "valid-preview-token")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if revisions.calls != 0 {
		t.Errorf("revisions.calls = %d, want 0 (preview must bypass revision probe)", revisions.calls)
	}
	if cache.lookupCalls != 0 || cache.saveCalls != 0 {
		t.Errorf("cache calls = %d lookup / %d save, want 0 (preview must bypass cache)", cache.lookupCalls, cache.saveCalls)
	}
}

func TestStorefrontPreviewCacheContamination(t *testing.T) {
	publishedStore := coreclient.StoreBootstrap{StoreCode: "store-a", StoreName: "Published"}
	draftStore := coreclient.StoreBootstrap{StoreCode: "store-a", StoreName: "Draft"}

	catalog := &stubCatalog{store: publishedStore}
	revisions := &stubRevisionProbe{rev: 10}
	cache := &stubCache{}

	router := chi.NewRouter()
	router.Use(i18n.Middleware(i18n.Default()))
	router.Route("/v1", func(r chi.Router) {
		RegisterStorefrontRoutes(Dependencies{
			Catalog:   catalog,
			Revisions: revisions,
			Cache:     cache,
			Platform:  config.Config{},
		})(r)
	})

	// 1. Normal request -> published
	req1 := httptest.NewRequest(http.MethodGet, "/v1/storefront/store", nil)
	req1.Host = domainA
	rec1 := httptest.NewRecorder()
	router.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusOK || !strings.Contains(rec1.Body.String(), "Published") {
		t.Fatalf("req 1 failed: %s", rec1.Body.String())
	}
	if cache.saveCalls != 1 {
		t.Fatalf("normal request should save to cache, got %d save calls", cache.saveCalls)
	}

	// 2. Preview request -> draft
	catalog.store = draftStore
	req2 := httptest.NewRequest(http.MethodGet, "/v1/storefront/store", nil)
	req2.Host = domainA
	req2.Header.Set("X-Matjero-Storefront-Preview", "token-123")
	rec2 := httptest.NewRecorder()
	router.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusOK || !strings.Contains(rec2.Body.String(), "Draft") {
		t.Fatalf("req 2 failed: %s", rec2.Body.String())
	}
	if cache.saveCalls != 1 {
		t.Fatalf("preview request must NOT save to cache, save calls still = %d", cache.saveCalls)
	}

	// 3. Normal request again -> published
	catalog.store = publishedStore
	req3 := httptest.NewRequest(http.MethodGet, "/v1/storefront/store", nil)
	req3.Host = domainA
	rec3 := httptest.NewRecorder()
	router.ServeHTTP(rec3, req3)
	if rec3.Code != http.StatusOK {
		t.Fatalf("req 3 failed: %s", rec3.Body.String())
	}
}

func TestStorefrontPreviewOversizedToken(t *testing.T) {
	catalog := &stubCatalog{}
	handler := newHandler(catalog, config.Config{})

	req := httptest.NewRequest(http.MethodGet, "/v1/storefront/store", nil)
	req.Host = domainA
	req.Header.Set("X-Matjero-Storefront-Preview", strings.Repeat("A", 4097))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 for oversized preview token", rec.Code)
	}
}

func TestStorefrontPreviewErrorMapping(t *testing.T) {
	cases := []struct {
		name       string
		err        error
		wantStatus int
		wantCode   string
	}{
		{
			name:       "preview unavailable",
			err:        &coreclient.Error{Status: 503, Code: coreclient.CodePreviewUnavailable},
			wantStatus: http.StatusServiceUnavailable,
			wantCode:   "preview_unavailable",
		},
		{
			name:       "stale/invalid preview token",
			err:        &coreclient.Error{Status: 404, Code: coreclient.CodeStorefrontUnavailable},
			wantStatus: http.StatusNotFound,
			wantCode:   "storefront_unavailable",
		},
		{
			name:       "schema mismatch",
			err:        &coreclient.Error{Status: 422, Code: coreclient.CodeSchemaMismatch},
			wantStatus: http.StatusBadRequest,
			wantCode:   "validation_error",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			catalog := &stubCatalog{err: tc.err}
			handler := newHandler(catalog, config.Config{})

			req := httptest.NewRequest(http.MethodGet, "/v1/storefront/store", nil)
			req.Host = domainA
			req.Header.Set("X-Matjero-Storefront-Preview", "some-token")
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d (body %q)", rec.Code, tc.wantStatus, rec.Body.String())
			}
			if got := decodeError(t, rec); got != tc.wantCode {
				t.Errorf("code = %q, want %q", got, tc.wantCode)
			}
		})
	}
}
