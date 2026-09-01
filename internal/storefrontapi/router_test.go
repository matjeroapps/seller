package storefrontapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/matjeroapps/core/packages/config"
	"github.com/matjeroapps/core/packages/money"
	"github.com/matjeroapps/core/pkg/actorapi"
	"github.com/matjeroapps/core/pkg/commerce"
	"github.com/matjeroapps/core/pkg/markets"
	"github.com/matjeroapps/core/pkg/storefront"
)

// Fixture prices: the supplier wholesale cost is shared, while each store sets its
// own listing price. The public payload must always carry the listing price.
const (
	supplierWholesaleMinor = 10000 // 100.00
	storeAPriceMinor       = 15000 // 150.00
	storeACheapPriceMinor  = 5000  // 50.00
	storeBPriceMinor       = 19900 // 199.00
)

const (
	domainA = "store-a.matjero.test"
	domainB = "store-b.matjero.test"
)

type apiEnv struct {
	ctx     context.Context
	pool    *pgxpool.Pool
	repo    commerce.Repository
	handler http.Handler
}

// setupAPITest builds the real public router over a real database with two stores
// that differ in domain, category, product, translation, and price.
func setupAPITest(t *testing.T) apiEnv {
	t.Helper()
	pool := openTestDB(t)
	ctx := context.Background()
	repo := commerce.NewRepository(pool)

	env := apiEnv{ctx: ctx, pool: pool, repo: repo}
	env.seed(t)

	deps := Dependencies{
		Catalog:  storefront.NewCatalogRepository(pool),
		Stores:   storefront.NewStoreResolver(repo),
		Platform: config.Config{PlatformDomain: "matjero.test"},
	}
	env.handler = actorapi.NewRouter(actorapi.Config{
		AppName:     "Storefront API",
		Actor:       "storefront",
		RequireAuth: false,
		Register: func(r chi.Router) {
			RegisterStorefrontRoutes(deps)(r)
		},
	}, markets.NewService(markets.NewRepository(pool)), nil)

	return env
}

func (e apiEnv) seed(t *testing.T) {
	t.Helper()

	sellerA, err := e.repo.CreateSeller(e.ctx, "seller-a", "Seller A", "active", nil)
	if err != nil {
		t.Fatalf("create seller A: %v", err)
	}
	sellerB, err := e.repo.CreateSeller(e.ctx, "seller-b", "Seller B", "active", nil)
	if err != nil {
		t.Fatalf("create seller B: %v", err)
	}

	settingsA := map[string]any{
		"public":   map[string]any{"tagline": "Store A tagline"},
		"internal": map[string]any{"supplier_margin_target": 0.35},
	}
	storeA, _, err := e.repo.CreateStoreWithDomain(e.ctx, sellerA.ID, "EG", "store-a", "Store A", "active", settingsA, domainA, "platform", "active", true, nil, nil)
	if err != nil {
		t.Fatalf("create store A: %v", err)
	}
	storeB, _, err := e.repo.CreateStoreWithDomain(e.ctx, sellerB.ID, "EG", "store-b", "Store B", "active", nil, domainB, "platform", "active", true, nil, nil)
	if err != nil {
		t.Fatalf("create store B: %v", err)
	}
	// An inactive store with an active domain must fail closed like an unknown host.
	if _, _, err := e.repo.CreateStoreWithDomain(e.ctx, sellerA.ID, "EG", "store-c", "Store C", "inactive", nil, "store-c.matjero.test", "platform", "active", true, nil, nil); err != nil {
		t.Fatalf("create inactive store: %v", err)
	}

	supplier, err := e.repo.CreateSupplier(e.ctx, "supplier-1", "Supplier One", "active", map[string]any{"contact_email": "ops@supplier.test"})
	if err != nil {
		t.Fatalf("create supplier: %v", err)
	}
	supplierMarket, err := e.repo.CreateSupplierMarket(e.ctx, supplier.ID, "EG", "active", nil)
	if err != nil {
		t.Fatalf("create supplier market: %v", err)
	}
	location, err := e.repo.CreateFulfillmentLocation(e.ctx, supplier.ID, supplierMarket.ID, "EG", "cairo-hub", "Cairo Hub", "warehouse", "active")
	if err != nil {
		t.Fatalf("create fulfillment location: %v", err)
	}

	lighting := e.category(t, "store-a-lighting", nil, "Lighting", "الإضاءة")
	kitchen := e.category(t, "store-b-kitchen", nil, "Kitchen", "المطبخ")

	lamp := e.product(t, "store-a-desk-lamp", "active", "Desk Lamp", "مصباح مكتبي", "A bright desk lamp", "مصباح مكتبي ساطع")
	e.assignCategory(t, lamp, lighting)
	e.stock(t, lamp, location.ID, 5)
	lampOffer := e.offer(t, supplier.ID, lamp, supplierMarket.ID)
	e.listing(t, storeA.ID, lamp, lampOffer, "active", storeAPriceMinor)

	shade := e.product(t, "store-a-lamp-shade", "active", "Lamp Shade", "غطاء مصباح", "", "")
	e.assignCategory(t, shade, lighting)
	e.stock(t, shade, location.ID, 0)
	shadeOffer := e.offer(t, supplier.ID, shade, supplierMarket.ID)
	e.listing(t, storeA.ID, shade, shadeOffer, "active", storeACheapPriceMinor)

	hidden := e.product(t, "store-a-hidden", "active", "Hidden Item", "عنصر مخفي", "", "")
	e.assignCategory(t, hidden, lighting)
	e.stock(t, hidden, location.ID, 3)
	hiddenOffer := e.offer(t, supplier.ID, hidden, supplierMarket.ID)
	e.listing(t, storeA.ID, hidden, hiddenOffer, "draft", storeAPriceMinor)

	pan := e.product(t, "store-b-frying-pan", "active", "Frying Pan", "مقلاة", "A non-stick pan", "مقلاة غير لاصقة")
	e.assignCategory(t, pan, kitchen)
	e.stock(t, pan, location.ID, 7)
	panOffer := e.offer(t, supplier.ID, pan, supplierMarket.ID)
	e.listing(t, storeB.ID, pan, panOffer, "active", storeBPriceMinor)
}

func (e apiEnv) category(t *testing.T, slug string, parent *string, nameEN, nameAR string) commerce.Category {
	t.Helper()
	category, err := e.repo.CreateCategory(e.ctx, slug, parent, "active")
	if err != nil {
		t.Fatalf("create category %s: %v", slug, err)
	}
	for locale, name := range map[string]string{"en": nameEN, "ar": nameAR} {
		if err := e.repo.UpsertCategoryTranslation(e.ctx, commerce.CategoryTranslation{
			CategoryID: category.ID, Locale: locale, Name: name,
		}); err != nil {
			t.Fatalf("translate category %s/%s: %v", slug, locale, err)
		}
	}
	return category
}

func (e apiEnv) product(t *testing.T, slug, status, nameEN, nameAR, descEN, descAR string) commerce.Product {
	t.Helper()
	product, err := e.repo.CreateProduct(e.ctx, slug, status)
	if err != nil {
		t.Fatalf("create product %s: %v", slug, err)
	}
	for _, translation := range []commerce.ProductTranslation{
		{ProductID: product.ID, Locale: "en", Name: nameEN, Description: descEN},
		{ProductID: product.ID, Locale: "ar", Name: nameAR, Description: descAR},
	} {
		if translation.Name == "" {
			continue
		}
		if err := e.repo.UpsertProductTranslation(e.ctx, translation); err != nil {
			t.Fatalf("translate product %s/%s: %v", slug, translation.Locale, err)
		}
	}
	return product
}

func (e apiEnv) assignCategory(t *testing.T, product commerce.Product, category commerce.Category) {
	t.Helper()
	if err := e.repo.SetProductCategories(e.ctx, product.ID, []string{category.ID}); err != nil {
		t.Fatalf("assign category: %v", err)
	}
}

func (e apiEnv) stock(t *testing.T, product commerce.Product, locationID string, onHand int64) {
	t.Helper()
	variant, err := e.repo.CreateVariant(e.ctx, product.ID, "default", "active")
	if err != nil {
		t.Fatalf("create variant: %v", err)
	}
	sku, err := e.repo.CreateSKU(e.ctx, variant.ID, "SKU-"+product.Slug, "", "active")
	if err != nil {
		t.Fatalf("create sku: %v", err)
	}
	if _, err := e.repo.CreateInventorySnapshot(e.ctx, locationID, sku.ID, onHand); err != nil {
		t.Fatalf("create inventory snapshot: %v", err)
	}
}

func (e apiEnv) offer(t *testing.T, supplierID string, product commerce.Product, supplierMarketID string) string {
	t.Helper()
	supplierProduct, err := e.repo.CreateSupplierProduct(e.ctx, supplierID, product.ID, "SUP-"+product.Slug, "active")
	if err != nil {
		t.Fatalf("create supplier product: %v", err)
	}
	offer, err := e.repo.CreateSupplierOffer(e.ctx, supplierID, supplierProduct.ID, supplierMarketID, "EG", "active")
	if err != nil {
		t.Fatalf("create supplier offer: %v", err)
	}
	if _, err := e.repo.SetSupplierOfferPrice(e.ctx, offer.ID, money.MustNew(supplierWholesaleMinor, "EGP")); err != nil {
		t.Fatalf("set supplier offer price: %v", err)
	}
	if _, err := e.repo.SetSupplierOfferAvailability(e.ctx, offer.ID, true, nil); err != nil {
		t.Fatalf("set supplier offer availability: %v", err)
	}
	return offer.ID
}

func (e apiEnv) listing(t *testing.T, storeID string, product commerce.Product, offerID, status string, priceMinor int64) {
	t.Helper()
	listing, err := e.repo.CreateSellerListing(e.ctx, storeID, product.ID, &offerID, "EG", status)
	if err != nil {
		t.Fatalf("create seller listing: %v", err)
	}
	if _, err := e.repo.SetSellerListingPrice(e.ctx, listing.ID, money.MustNew(priceMinor, "EGP")); err != nil {
		t.Fatalf("set seller listing price: %v", err)
	}
}

// get issues a public request as a customer would: the tenant comes from Host.
func (e apiEnv) get(t *testing.T, host, target string) (*httptest.ResponseRecorder, string) {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, target, nil)
	req.Host = host
	rec := httptest.NewRecorder()
	e.handler.ServeHTTP(rec, req)
	return rec, rec.Body.String()
}

func (e apiEnv) getJSON(t *testing.T, host, target string, dst any) string {
	t.Helper()
	rec, body := e.get(t, host, target)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET %s (host %s): expected 200, got %d: %s", target, host, rec.Code, body)
	}
	if err := json.Unmarshal([]byte(body), dst); err != nil {
		t.Fatalf("decode %s: %v (%s)", target, err, body)
	}
	return body
}

func slugsOf(page ProductCollectionResponse) []string {
	slugs := make([]string, 0, len(page.Items))
	for _, item := range page.Items {
		slugs = append(slugs, item.Slug)
	}
	return slugs
}

func containsSlug(slugs []string, want string) bool {
	for _, slug := range slugs {
		if slug == want {
			return true
		}
	}
	return false
}

func TestStorefrontStoreResolvesFromHost(t *testing.T) {
	env := setupAPITest(t)

	var response StoreResponse
	env.getJSON(t, domainA, "/v1/storefront/store", &response)
	if response.Store.StoreCode != "store-a" || response.Store.StoreName != "Store A" {
		t.Fatalf("unexpected store: %+v", response.Store)
	}
	if response.Store.Market != "EG" || response.Store.Currency.Code != "EGP" {
		t.Fatalf("unexpected market context: %+v", response.Store)
	}
	if response.Store.Settings["tagline"] != "Store A tagline" {
		t.Fatalf("expected public settings, got %+v", response.Store.Settings)
	}

	var responseB StoreResponse
	env.getJSON(t, domainB, "/v1/storefront/store", &responseB)
	if responseB.Store.StoreCode != "store-b" {
		t.Fatalf("expected store B for host B, got %+v", responseB.Store)
	}
}

// A client-supplied store or seller identifier must never override the host tenant.
func TestStorefrontIgnoresClientSuppliedTenantHints(t *testing.T) {
	env := setupAPITest(t)

	var baseline StoreResponse
	env.getJSON(t, domainA, "/v1/storefront/store", &baseline)

	var storeBID string
	if err := env.pool.QueryRow(env.ctx, `SELECT id FROM stores WHERE code = 'store-b'`).Scan(&storeBID); err != nil {
		t.Fatalf("look up store B: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/v1/storefront/store?store_id="+storeBID+"&seller_id="+storeBID, nil)
	req.Host = domainA
	req.Header.Set("X-Store-ID", storeBID)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var spoofed StoreResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &spoofed); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if spoofed.Store.StoreCode != baseline.Store.StoreCode {
		t.Fatalf("client-supplied tenant hint overrode the host: %+v", spoofed.Store)
	}
}

// A forwarded host must be ignored unless the deployment explicitly trusts a proxy.
func TestStorefrontIgnoresUntrustedForwardedHost(t *testing.T) {
	env := setupAPITest(t)

	req := httptest.NewRequest(http.MethodGet, "/v1/storefront/store", nil)
	req.Host = domainA
	req.Header.Set("X-Forwarded-Host", domainB)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var response StoreResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if response.Store.StoreCode != "store-a" {
		t.Fatalf("spoofed forwarded host changed the tenant: %+v", response.Store)
	}
}

func TestStorefrontUnavailableHostsFailGenerically(t *testing.T) {
	env := setupAPITest(t)

	for _, host := range []string{"unknown.matjero.test", "store-c.matjero.test"} {
		rec, body := env.get(t, host, "/v1/storefront/store")
		if rec.Code != http.StatusNotFound {
			t.Fatalf("host %s: expected 404, got %d: %s", host, rec.Code, body)
		}
		lower := strings.ToLower(body)
		for _, leak := range []string{"suspend", "inactive", "disabled", "seller", "moderation", "verification"} {
			if strings.Contains(lower, leak) {
				t.Fatalf("host %s: response leaked %q: %s", host, leak, body)
			}
		}
	}
}

func TestStorefrontTwoStoreIsolation(t *testing.T) {
	env := setupAPITest(t)

	var pageA ProductCollectionResponse
	env.getJSON(t, domainA, "/v1/storefront/products", &pageA)
	slugsA := slugsOf(pageA)
	if !containsSlug(slugsA, "store-a-desk-lamp") || containsSlug(slugsA, "store-b-frying-pan") {
		t.Fatalf("store A products wrong: %v", slugsA)
	}

	var pageB ProductCollectionResponse
	env.getJSON(t, domainB, "/v1/storefront/products", &pageB)
	slugsB := slugsOf(pageB)
	if !containsSlug(slugsB, "store-b-frying-pan") {
		t.Fatalf("store B products wrong: %v", slugsB)
	}
	for _, slug := range slugsB {
		if strings.HasPrefix(slug, "store-a-") {
			t.Fatalf("store A product leaked into store B: %v", slugsB)
		}
	}

	// Cross-store slug detail must 404 in both directions.
	if rec, body := env.get(t, domainA, "/v1/storefront/products/store-b-frying-pan"); rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for cross-store product, got %d: %s", rec.Code, body)
	}
	if rec, body := env.get(t, domainB, "/v1/storefront/products/store-a-desk-lamp"); rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for cross-store product, got %d: %s", rec.Code, body)
	}
	if rec, body := env.get(t, domainA, "/v1/storefront/categories/store-b-kitchen"); rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for cross-store category, got %d: %s", rec.Code, body)
	}
	if rec, body := env.get(t, domainB, "/v1/storefront/categories/store-a-lighting"); rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for cross-store category, got %d: %s", rec.Code, body)
	}

	// Search must not cross tenants either.
	var searchA ProductCollectionResponse
	env.getJSON(t, domainA, "/v1/storefront/search?q=frying", &searchA)
	if len(searchA.Items) != 0 {
		t.Fatalf("store B content matched a store A search: %v", slugsOf(searchA))
	}
	var searchB ProductCollectionResponse
	env.getJSON(t, domainB, "/v1/storefront/search?q=desk", &searchB)
	if len(searchB.Items) != 0 {
		t.Fatalf("store A content matched a store B search: %v", slugsOf(searchB))
	}
}

func TestStorefrontCategories(t *testing.T) {
	env := setupAPITest(t)

	var collection CategoryCollectionResponse
	env.getJSON(t, domainA, "/v1/storefront/categories", &collection)
	if len(collection.Items) != 1 || collection.Items[0].Slug != "store-a-lighting" {
		t.Fatalf("unexpected categories: %+v", collection.Items)
	}

	var single CategoryResponse
	env.getJSON(t, domainA, "/v1/storefront/categories/store-a-lighting", &single)
	if single.Category.Name != "Lighting" || single.Category.ProductCount != 2 {
		t.Fatalf("unexpected category: %+v", single.Category)
	}
}

func TestStorefrontLocalizedResponses(t *testing.T) {
	env := setupAPITest(t)

	var en ProductResponse
	env.getJSON(t, domainA, "/v1/storefront/products/store-a-desk-lamp?locale=en", &en)
	if en.Product.Name != "Desk Lamp" || en.Product.Description != "A bright desk lamp" {
		t.Fatalf("unexpected English payload: %+v", en.Product)
	}

	var ar ProductResponse
	env.getJSON(t, domainA, "/v1/storefront/products/store-a-desk-lamp?locale=ar", &ar)
	if ar.Product.Name != "مصباح مكتبي" || ar.Product.Description != "مصباح مكتبي ساطع" {
		t.Fatalf("unexpected Arabic payload: %+v", ar.Product)
	}
	if ar.Product.Slug != en.Product.Slug {
		t.Fatalf("slug must be locale-stable: %q vs %q", ar.Product.Slug, en.Product.Slug)
	}

	// An unsupported locale must not change the tenant or fail the request; the
	// locale middleware negotiates a supported value.
	rec, body := env.get(t, domainA, "/v1/storefront/products/store-a-desk-lamp?locale=fr")
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for an unsupported locale, got %d: %s", rec.Code, body)
	}
}

func TestStorefrontPublicPriceIsSellerListingPrice(t *testing.T) {
	env := setupAPITest(t)

	var detail ProductResponse
	body := env.getJSON(t, domainA, "/v1/storefront/products/store-a-desk-lamp", &detail)
	if detail.Product.Price.AmountMinor != storeAPriceMinor || detail.Product.Price.Currency != "EGP" {
		t.Fatalf("expected the seller listing price, got %+v", detail.Product.Price)
	}
	if strings.Contains(body, "10000") {
		t.Fatalf("supplier wholesale amount leaked into the HTTP response: %s", body)
	}

	var detailB ProductResponse
	env.getJSON(t, domainB, "/v1/storefront/products/store-b-frying-pan", &detailB)
	if detailB.Product.Price.AmountMinor != storeBPriceMinor {
		t.Fatalf("expected store B price %d, got %+v", storeBPriceMinor, detailB.Product.Price)
	}
}

func TestStorefrontExcludesNonPublicListings(t *testing.T) {
	env := setupAPITest(t)

	var page ProductCollectionResponse
	env.getJSON(t, domainA, "/v1/storefront/products", &page)
	if containsSlug(slugsOf(page), "store-a-hidden") {
		t.Fatalf("draft listing appeared publicly: %v", slugsOf(page))
	}
	if rec, body := env.get(t, domainA, "/v1/storefront/products/store-a-hidden"); rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for a draft listing, got %d: %s", rec.Code, body)
	}
}

func TestStorefrontFiltersSortAndPagination(t *testing.T) {
	env := setupAPITest(t)

	cases := map[string][]string{
		"/v1/storefront/products?min_price=5001":                          {"store-a-desk-lamp"},
		"/v1/storefront/products?max_price=5000":                          {"store-a-lamp-shade"},
		"/v1/storefront/products?availability=in_stock":                   {"store-a-desk-lamp"},
		"/v1/storefront/products?availability=out_of_stock":               {"store-a-lamp-shade"},
		"/v1/storefront/products?sort=price_asc":                          {"store-a-lamp-shade", "store-a-desk-lamp"},
		"/v1/storefront/products?sort=price_desc":                         {"store-a-desk-lamp", "store-a-lamp-shade"},
		"/v1/storefront/products?category=store-a-lighting&sort=name_asc": {"store-a-desk-lamp", "store-a-lamp-shade"},
	}
	for target, want := range cases {
		var page ProductCollectionResponse
		env.getJSON(t, domainA, target, &page)
		got := slugsOf(page)
		if len(got) != len(want) {
			t.Fatalf("%s: expected %v, got %v", target, want, got)
		}
		for i := range want {
			if got[i] != want[i] {
				t.Fatalf("%s: expected %v, got %v", target, want, got)
			}
		}
	}

	var first, second ProductCollectionResponse
	env.getJSON(t, domainA, "/v1/storefront/products?sort=price_asc&limit=1", &first)
	env.getJSON(t, domainA, "/v1/storefront/products?sort=price_asc&limit=1&offset=1", &second)
	if first.Pagination.Total != 2 || second.Pagination.Total != 2 {
		t.Fatalf("unexpected totals: %d and %d", first.Pagination.Total, second.Pagination.Total)
	}
	if first.Pagination.Limit != 1 || second.Pagination.Offset != 1 {
		t.Fatalf("pagination envelope wrong: %+v %+v", first.Pagination, second.Pagination)
	}
	if len(first.Items) != 1 || len(second.Items) != 1 || first.Items[0].Slug == second.Items[0].Slug {
		t.Fatalf("unstable pagination: %v then %v", slugsOf(first), slugsOf(second))
	}

	// Default page size is applied when the caller omits limit.
	var defaults ProductCollectionResponse
	env.getJSON(t, domainA, "/v1/storefront/products", &defaults)
	if defaults.Pagination.Limit != storefront.DefaultPageLimit {
		t.Fatalf("expected the default limit %d, got %d", storefront.DefaultPageLimit, defaults.Pagination.Limit)
	}
}

func TestStorefrontRejectsInvalidFilters(t *testing.T) {
	env := setupAPITest(t)

	for _, target := range []string{
		"/v1/storefront/products?limit=1000000",
		"/v1/storefront/products?limit=-1",
		"/v1/storefront/products?offset=-1",
		"/v1/storefront/products?limit=many",
		"/v1/storefront/products?min_price=-5",
		"/v1/storefront/products?min_price=900&max_price=100",
		"/v1/storefront/products?min_price=cheap",
		"/v1/storefront/products?sort=random",
		"/v1/storefront/products?availability=maybe",
		"/v1/storefront/search?q=lamp&sort=random",
	} {
		rec, body := env.get(t, domainA, target)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("%s: expected 400, got %d: %s", target, rec.Code, body)
		}
	}

	// An unknown filter is ignored rather than rejected, matching the platform's
	// tolerant query handling elsewhere.
	if rec, body := env.get(t, domainA, "/v1/storefront/products?unknown=1"); rec.Code != http.StatusOK {
		t.Fatalf("expected an unknown filter to be ignored, got %d: %s", rec.Code, body)
	}
}

func TestStorefrontSearch(t *testing.T) {
	env := setupAPITest(t)

	var en ProductCollectionResponse
	env.getJSON(t, domainA, "/v1/storefront/search?q=desk", &en)
	if len(en.Items) != 1 || en.Items[0].Slug != "store-a-desk-lamp" {
		t.Fatalf("unexpected English search results: %v", slugsOf(en))
	}

	var ar ProductCollectionResponse
	env.getJSON(t, domainA, "/v1/storefront/search?locale=ar&q=%D9%85%D8%B5%D8%A8%D8%A7%D8%AD%20%D9%85%D9%83%D8%AA%D8%A8%D9%8A", &ar)
	if len(ar.Items) != 1 || ar.Items[0].Slug != "store-a-desk-lamp" {
		t.Fatalf("unexpected Arabic search results: %v", slugsOf(ar))
	}

	var empty ProductCollectionResponse
	env.getJSON(t, domainA, "/v1/storefront/search?q=nothing-matches-this", &empty)
	if len(empty.Items) != 0 || empty.Pagination.Total != 0 {
		t.Fatalf("expected an empty result set, got %+v", empty)
	}
}

func TestStorefrontUnknownSlugsReturnNotFound(t *testing.T) {
	env := setupAPITest(t)

	if rec, body := env.get(t, domainA, "/v1/storefront/products/nope"); rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", rec.Code, body)
	}
	if rec, body := env.get(t, domainA, "/v1/storefront/categories/nope"); rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", rec.Code, body)
	}
}
