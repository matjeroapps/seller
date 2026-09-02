package sellerapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/matjeroapps/seller/internal/auth"
	"github.com/matjeroapps/seller/internal/coreclient"
	"github.com/matjeroapps/seller/internal/i18n"
)

// These tests prove the Seller API's transport and BFF behaviour against a local
// stub Core. They need no PostgreSQL, no Core migrations and no Core module.

const testSubject = "user-subject-123"

// stubCore records the calls the handlers make and returns canned results.
type stubCore struct {
	// subject records the forwarded end-user subject on the last call.
	subject string
	// sellerID records the seller identifier the last call addressed.
	sellerID string
	// storeID records the store identifier the last call addressed.
	storeID string
	// page records the forwarded pagination window.
	page coreclient.Page

	err error

	seller    coreclient.Seller
	settings  map[string]any
	status    string
	stores    []coreclient.Store
	store     coreclient.Store
	catalog   []coreclient.SupplierCatalogItem
	listings  []coreclient.SellerListing
	listing   coreclient.SellerListing
	themes    []coreclient.Theme
	versions  []coreclient.ThemeVersion
	install   coreclient.ThemeInstallationResponse
	draft     coreclient.ThemeDraft
	published coreclient.ThemePublish
	preview   coreclient.ThemePreview
	host      string
}

func (s *stubCore) GetStorefrontHost(ctx context.Context, storeID, subject string) (string, error) {
	s.storeID, s.subject = storeID, subject
	return s.host, s.err
}

func (s *stubCore) ResolveSeller(ctx context.Context, subject string) (string, error) {
	s.subject = subject
	return "seller-resolved", s.err
}

func (s *stubCore) GetSeller(ctx context.Context, sellerID, subject string) (coreclient.Seller, map[string]any, error) {
	s.sellerID, s.subject = sellerID, subject
	return s.seller, s.settings, s.err
}

func (s *stubCore) UpdateSellerProfile(ctx context.Context, sellerID, subject string, update coreclient.ProfileUpdate) (string, error) {
	s.sellerID, s.subject = sellerID, subject
	return s.status, s.err
}

func (s *stubCore) ListSellerStores(ctx context.Context, sellerID, subject string, page coreclient.Page) ([]coreclient.Store, error) {
	s.sellerID, s.subject, s.page = sellerID, subject, page
	return s.stores, s.err
}

func (s *stubCore) CreateSellerStore(ctx context.Context, sellerID, subject string, create coreclient.StoreCreate) (coreclient.Store, error) {
	s.sellerID, s.subject = sellerID, subject
	return s.store, s.err
}

func (s *stubCore) GetStore(ctx context.Context, storeID, subject string) (coreclient.Store, error) {
	s.storeID, s.subject = storeID, subject
	return s.store, s.err
}

func (s *stubCore) ListSupplierCatalog(ctx context.Context, storeID, subject string, filter coreclient.SupplierCatalogFilter) ([]coreclient.SupplierCatalogItem, error) {
	s.storeID, s.subject, s.page = storeID, subject, filter.Page
	return s.catalog, s.err
}

func (s *stubCore) ListStoreListings(ctx context.Context, storeID, subject string, page coreclient.Page) ([]coreclient.SellerListing, error) {
	s.storeID, s.subject, s.page = storeID, subject, page
	return s.listings, s.err
}

func (s *stubCore) ImportListing(ctx context.Context, storeID, subject string, importReq coreclient.ListingImport) (coreclient.SellerListing, error) {
	s.storeID, s.subject = storeID, subject
	return s.listing, s.err
}

func (s *stubCore) SetListingPrice(ctx context.Context, listingID, subject string, price coreclient.PriceUpdate) error {
	s.subject = subject
	return s.err
}

func (s *stubCore) UpdateListingStatus(ctx context.Context, listingID, subject, status string) error {
	s.subject = subject
	return s.err
}

func (s *stubCore) ListThemes(ctx context.Context, subject string) ([]coreclient.Theme, error) {
	s.subject = subject
	return s.themes, s.err
}

func (s *stubCore) ListThemeVersions(ctx context.Context, key, subject string) ([]coreclient.ThemeVersion, error) {
	s.subject = subject
	return s.versions, s.err
}

func (s *stubCore) GetThemeInstallation(ctx context.Context, storeID, subject string) (coreclient.ThemeInstallationResponse, error) {
	s.storeID, s.subject = storeID, subject
	return s.install, s.err
}

func (s *stubCore) InstallTheme(ctx context.Context, storeID, subject string, install coreclient.ThemeInstall) (coreclient.ThemeInstallationResponse, error) {
	s.storeID, s.subject = storeID, subject
	return s.install, s.err
}

func (s *stubCore) GetThemeDraft(ctx context.Context, storeID, subject string) (coreclient.ThemeDraft, error) {
	s.storeID, s.subject = storeID, subject
	return s.draft, s.err
}

func (s *stubCore) UpdateThemeDraft(ctx context.Context, storeID, subject string, config map[string]any) (coreclient.ThemeDraft, error) {
	s.storeID, s.subject = storeID, subject
	return s.draft, s.err
}

func (s *stubCore) PublishTheme(ctx context.Context, storeID, subject string) (coreclient.ThemePublish, error) {
	s.storeID, s.subject = storeID, subject
	return s.published, s.err
}

func (s *stubCore) DiscardThemeDraft(ctx context.Context, storeID, subject string) (coreclient.ThemeDraft, error) {
	s.storeID, s.subject = storeID, subject
	return s.draft, s.err
}

func (s *stubCore) UpgradeTheme(ctx context.Context, storeID, subject, version string) error {
	s.storeID, s.subject = storeID, subject
	return s.err
}

func (s *stubCore) CreateThemePreview(ctx context.Context, storeID, subject string) (coreclient.ThemePreview, error) {
	s.storeID, s.subject = storeID, subject
	return s.preview, s.err
}

// newHandler builds the seller routes behind an authenticated principal.
func newHandler(core CoreCapabilities, themes ThemeCapabilities) http.Handler {
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
		RegisterSellerRoutes(Dependencies{Core: core})(r)
		RegisterSellerThemeRoutes(ThemeDependencies{Themes: themes})(r)
	})
	return router
}

func doRequest(t *testing.T, handler http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	var reader *strings.Reader
	if body == "" {
		reader = strings.NewReader("")
	} else {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func decodeError(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var payload struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode error envelope: %v (body %q)", err, rec.Body.String())
	}
	return payload.Error.Code
}

// --- forwarded actor identity ---

func TestSellerForwardsAuthenticatedSubject(t *testing.T) {
	core := &stubCore{}
	handler := newHandler(core, core)

	doRequest(t, handler, http.MethodGet, "/v1/seller/profile", "")

	if core.subject != testSubject {
		t.Fatalf("forwarded subject = %q, want %q", core.subject, testSubject)
	}
}

// A client-supplied internal identity header must never be trusted: the subject
// always comes from the validated principal on the request context.
func TestSellerIgnoresClientSuppliedSubjectHeader(t *testing.T) {
	core := &stubCore{}
	handler := newHandler(core, core)

	req := httptest.NewRequest(http.MethodGet, "/v1/seller/profile", nil)
	req.Header.Set("X-Matjero-Subject", "attacker-subject")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if core.subject != testSubject {
		t.Fatalf("forwarded subject = %q, want the authenticated principal %q", core.subject, testSubject)
	}
}

// --- request mapping ---

func TestSellerMapsPagination(t *testing.T) {
	core := &stubCore{}
	handler := newHandler(core, core)

	doRequest(t, handler, http.MethodGet, "/v1/seller/stores?limit=10&offset=20", "")

	if core.page.Limit != 10 || core.page.Offset != 20 {
		t.Fatalf("forwarded page = %+v, want limit 10 offset 20", core.page)
	}
}

func TestSellerClampsPagination(t *testing.T) {
	core := &stubCore{}
	handler := newHandler(core, core)

	doRequest(t, handler, http.MethodGet, "/v1/seller/stores?limit=9999&offset=-5", "")

	if core.page.Limit != 25 {
		t.Errorf("limit = %d, want the default 25 when above the maximum", core.page.Limit)
	}
	if core.page.Offset != 0 {
		t.Errorf("offset = %d, want 0 when negative", core.page.Offset)
	}
}

func TestSellerMapsProfileUpdate(t *testing.T) {
	core := &stubCore{status: "active"}
	handler := newHandler(core, core)

	rec := doRequest(t, handler, http.MethodPut, "/v1/seller/profile", `{"name":"New Name","status":"active","settings":{"k":"v"}}`)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (body %q)", rec.Code, rec.Body.String())
	}
	if core.sellerID != "seller-resolved" {
		t.Errorf("addressed seller = %q, want the resolved identity", core.sellerID)
	}
}

func TestSellerRejectsInvalidJSON(t *testing.T) {
	core := &stubCore{}
	handler := newHandler(core, core)

	rec := doRequest(t, handler, http.MethodPut, "/v1/seller/profile", `{"name":`)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body %q)", rec.Code, rec.Body.String())
	}
	if got := decodeError(t, rec); got != "invalid_json" {
		t.Errorf("error code = %q, want invalid_json", got)
	}
}

// A malformed currency is rejected locally rather than round-tripped to Core.
func TestSellerValidatesPriceLocally(t *testing.T) {
	core := &stubCore{}
	handler := newHandler(core, core)

	rec := doRequest(t, handler, http.MethodPost, "/v1/seller/listings/listing-1/price", `{"amount_minor":100,"currency":"NOT_A_CURRENCY"}`)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body %q)", rec.Code, rec.Body.String())
	}
	if got := decodeError(t, rec); got != "validation_error" {
		t.Errorf("error code = %q, want validation_error", got)
	}
}

// --- response mapping ---

func TestSellerMapsProfileResponse(t *testing.T) {
	core := &stubCore{
		seller:   coreclient.Seller{ID: "seller-1", Code: "seller-a", Name: "Seller A", Status: "active"},
		settings: map[string]any{"theme": "dark"},
	}
	handler := newHandler(core, core)

	rec := doRequest(t, handler, http.MethodGet, "/v1/seller/profile", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (body %q)", rec.Code, rec.Body.String())
	}

	var payload SellerProfileResponse
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if payload.Seller.ID != "seller-1" {
		t.Errorf("seller id = %q, want seller-1", payload.Seller.ID)
	}
	if payload.Settings["theme"] != "dark" {
		t.Errorf("settings = %+v, want theme dark", payload.Settings)
	}
}

func TestSellerStoreCreateReturns201(t *testing.T) {
	core := &stubCore{store: coreclient.Store{ID: "store-1", Code: "store-a"}}
	handler := newHandler(core, core)

	rec := doRequest(t, handler, http.MethodPost, "/v1/seller/stores", `{"market_code":"EG","code":"store-a","name":"Store A","status":"active"}`)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201 (body %q)", rec.Code, rec.Body.String())
	}
}

// --- public error mapping ---

func TestSellerMapsCoreErrorsToPublicResponses(t *testing.T) {
	cases := []struct {
		name       string
		code       string
		wantStatus int
		wantCode   string
	}{
		{"not found", coreclient.CodeNotFound, http.StatusNotFound, "not_found"},
		{"validation", coreclient.CodeValidationError, http.StatusBadRequest, "validation_error"},
		{"market mismatch", coreclient.CodeMarketMismatch, http.StatusConflict, "market_mismatch"},
		{"insufficient inventory", coreclient.CodeInsufficientInventory, http.StatusConflict, "insufficient_inventory"},
		{"conflict", coreclient.CodeConflict, http.StatusConflict, "conflict"},
		{"forbidden", coreclient.CodeForbidden, http.StatusForbidden, "forbidden"},
		{"internal", coreclient.CodeInternalError, http.StatusInternalServerError, "internal_error"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			core := &stubCore{err: &coreclient.Error{Status: tc.wantStatus, Code: tc.code}}
			handler := newHandler(core, core)

			rec := doRequest(t, handler, http.MethodGet, "/v1/seller/profile", "")

			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d (body %q)", rec.Code, tc.wantStatus, rec.Body.String())
			}
			if got := decodeError(t, rec); got != tc.wantCode {
				t.Errorf("error code = %q, want %q", got, tc.wantCode)
			}
		})
	}
}

func TestSellerReturns503WhenCoreUnavailable(t *testing.T) {
	core := &stubCore{err: coreclient.ErrUnavailable}
	handler := newHandler(core, core)

	rec := doRequest(t, handler, http.MethodGet, "/v1/seller/profile", "")

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503 (body %q)", rec.Code, rec.Body.String())
	}
	if got := decodeError(t, rec); got != "service_unavailable" {
		t.Errorf("error code = %q, want service_unavailable", got)
	}
	body := rec.Body.String()
	for _, leak := range []string{"connection refused", "core-api", "dial tcp"} {
		if strings.Contains(body, leak) {
			t.Errorf("response leaked transport detail %q: %s", leak, body)
		}
	}
}

// --- themes ---

func TestSellerThemeErrorMapping(t *testing.T) {
	cases := []struct {
		name       string
		code       string
		wantStatus int
		wantCode   string
	}{
		{"not found", coreclient.CodeNotFound, http.StatusNotFound, "not_found"},
		{"conflict", coreclient.CodeConflict, http.StatusConflict, "conflict"},
		{"schema mismatch", coreclient.CodeSchemaMismatch, http.StatusBadRequest, "schema_mismatch"},
		{"unsafe content", coreclient.CodeUnsafeContent, http.StatusBadRequest, "unsafe_content"},
		{"validation", coreclient.CodeValidationError, http.StatusBadRequest, "validation_error"},
		{"preview unavailable", coreclient.CodePreviewUnavailable, http.StatusServiceUnavailable, "preview_unavailable"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			core := &stubCore{err: &coreclient.Error{Status: tc.wantStatus, Code: tc.code}}
			handler := newHandler(core, core)

			rec := doRequest(t, handler, http.MethodGet, "/v1/seller/themes", "")

			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d (body %q)", rec.Code, tc.wantStatus, rec.Body.String())
			}
			if got := decodeError(t, rec); got != tc.wantCode {
				t.Errorf("error code = %q, want %q", got, tc.wantCode)
			}
		})
	}
}

// A preview token must never be issued when Core reports preview as
// unconfigured, and the response must not contain a token field at all.
func TestSellerPreviewUnavailableNeverReturnsToken(t *testing.T) {
	core := &stubCore{err: &coreclient.Error{Status: 503, Code: coreclient.CodePreviewUnavailable}}
	handler := newHandler(core, core)

	rec := doRequest(t, handler, http.MethodPost, "/v1/seller/stores/store-1/theme/preview", "")

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503 (body %q)", rec.Code, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), "token") {
		t.Errorf("response must not contain a token: %s", rec.Body.String())
	}
}

func TestSellerThemeRoutesForwardSubject(t *testing.T) {
	core := &stubCore{themes: []coreclient.Theme{{Key: "aurora"}}}
	handler := newHandler(core, core)

	rec := doRequest(t, handler, http.MethodGet, "/v1/seller/themes", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (body %q)", rec.Code, rec.Body.String())
	}
	if core.subject != testSubject {
		t.Errorf("forwarded subject = %q, want %q", core.subject, testSubject)
	}
}

func TestSellerThemePublishMapsRevision(t *testing.T) {
	core := &stubCore{published: coreclient.ThemePublish{PublishedRevision: 7}}
	handler := newHandler(core, core)

	rec := doRequest(t, handler, http.MethodPost, "/v1/seller/stores/store-1/theme/publish", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (body %q)", rec.Code, rec.Body.String())
	}

	var payload ThemePublishResponse
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if payload.PublishedRevision != 7 {
		t.Errorf("published revision = %d, want 7", payload.PublishedRevision)
	}
}

func TestGetSellerStorefrontHost(t *testing.T) {
	t.Run("returns storefront host for authorized owner", func(t *testing.T) {
		core := &stubCore{host: "custom.example.com"}
		handler := newHandler(core, core)

		rec := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/store-99/storefront-host", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
		}
		if core.storeID != "store-99" {
			t.Errorf("storeID = %q, want store-99", core.storeID)
		}
		if core.subject != testSubject {
			t.Errorf("subject = %q, want %q", core.subject, testSubject)
		}

		var payload StorefrontHostResponse
		if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
			t.Fatalf("decode response: %v", err)
		}
		if payload.Host != "custom.example.com" {
			t.Errorf("host = %q, want custom.example.com", payload.Host)
		}
	})

	t.Run("maps core 404 to public not_found", func(t *testing.T) {
		core := &stubCore{err: &coreclient.Error{Status: http.StatusNotFound, Code: coreclient.CodeNotFound}}
		handler := newHandler(core, core)

		rec := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/store-99/storefront-host", "")
		if rec.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404 (body %q)", rec.Code, rec.Body.String())
		}
		if got := decodeError(t, rec); got != "not_found" {
			t.Errorf("error code = %q, want not_found", got)
		}
	})

	t.Run("maps core unavailable to 503", func(t *testing.T) {
		core := &stubCore{err: coreclient.ErrUnavailable}
		handler := newHandler(core, core)

		rec := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/store-99/storefront-host", "")
		if rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want 503 (body %q)", rec.Code, rec.Body.String())
		}
	})
}
