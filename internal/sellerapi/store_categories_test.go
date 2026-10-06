package sellerapi

// Store-scoped category BFF tests: route wiring, role gates, body passthrough
// and Core error normalization, against the shared stubCore.

import (
	"net/http"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"seller/internal/auth"
	"seller/internal/coreclient"
	"seller/internal/i18n"
)

func newCategoryHandler(core CoreCapabilities) http.Handler {
	return newHandler(core, nil)
}

func TestStoreCategoryRoutesPassthrough(t *testing.T) {
	stub := &stubCore{
		storeCategories: []coreclient.StoreCategory{
			{ID: "cat_1", StoreID: "store-1", Slug: "winter", Status: "active", Translations: map[string]coreclient.StoreCategoryTranslation{"en": {Name: "Winter"}}},
		},
	}
	handler := newCategoryHandler(stub)

	// List.
	rec := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/store-1/categories", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("list status = %d (body %q)", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"slug":"winter"`) {
		t.Fatalf("list body missing category: %q", rec.Body.String())
	}
	if stub.subject != testSubject || stub.storeID != "store-1" {
		t.Fatalf("list forwarded subject=%q store=%q", stub.subject, stub.storeID)
	}

	// Create: 201 with the Core response passed through.
	rec = doRequest(t, handler, http.MethodPost, "/v1/seller/stores/store-1/categories",
		`{"slug":"winter","translations":{"en":{"name":"Winter","description":""}}}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create status = %d (body %q)", rec.Code, rec.Body.String())
	}
	if stub.categoryInput.Slug != "winter" {
		t.Fatalf("create forwarded input = %+v", stub.categoryInput)
	}

	// Update.
	rec = doRequest(t, handler, http.MethodPut, "/v1/seller/stores/store-1/categories/cat_1",
		`{"slug":"winter-2"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("update status = %d (body %q)", rec.Code, rec.Body.String())
	}
	if stub.categoryID != "cat_1" {
		t.Fatalf("update category id = %q", stub.categoryID)
	}

	// Status transition.
	rec = doRequest(t, handler, http.MethodPost, "/v1/seller/stores/store-1/categories/cat_1/status",
		`{"status":"archived"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status transition = %d (body %q)", rec.Code, rec.Body.String())
	}
	if stub.status != "archived" {
		t.Fatalf("status forwarded = %q", stub.status)
	}

	// Delete.
	rec = doRequest(t, handler, http.MethodDelete, "/v1/seller/stores/store-1/categories/cat_1", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("delete status = %d (body %q)", rec.Code, rec.Body.String())
	}

	// Reorder.
	rec = doRequest(t, handler, http.MethodPost, "/v1/seller/stores/store-1/categories/reorder",
		`{"order":[{"id":"b","sort_order":0},{"id":"a","sort_order":1}]}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("reorder status = %d (body %q)", rec.Code, rec.Body.String())
	}
	if len(stub.reorderOrder) != 2 || stub.reorderOrder[0].ID != "b" {
		t.Fatalf("reorder forwarded = %+v", stub.reorderOrder)
	}
}

func TestStoreCategoryErrorNormalization(t *testing.T) {
	cases := []struct {
		name       string
		coreErr    error
		wantStatus int
		wantCode   string
	}{
		{"conflict", &coreclient.Error{Status: http.StatusConflict, Code: "conflict", Message: "conflict"}, http.StatusConflict, "conflict"},
		{"not found", &coreclient.Error{Status: http.StatusNotFound, Code: "not_found", Message: "resource not found"}, http.StatusNotFound, "not_found"},
		{"validation", &coreclient.Error{Status: http.StatusBadRequest, Code: "validation_error", Message: "invalid input"}, http.StatusBadRequest, "validation_error"},
		{"forbidden", &coreclient.Error{Status: http.StatusForbidden, Code: "forbidden", Message: "forbidden"}, http.StatusForbidden, "forbidden"},
		{"unavailable", coreclient.ErrUnavailable, http.StatusServiceUnavailable, "service_unavailable"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			stub := &stubCore{err: tc.coreErr}
			handler := newCategoryHandler(stub)

			rec := doRequest(t, handler, http.MethodPost, "/v1/seller/stores/store-1/categories",
				`{"slug":"x","translations":{"en":{"name":"X"}}}`)
			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d (body %q)", rec.Code, tc.wantStatus, rec.Body.String())
			}
			if code := decodeError(t, rec); code != tc.wantCode {
				t.Fatalf("code = %q, want %q", code, tc.wantCode)
			}
		})
	}
}

func TestStoreCategoryRoleGate(t *testing.T) {
	stub := &stubCore{}

	// Staff may manage categories (parity with products), so a staff principal
	// can create; an unauthenticated request cannot.
	staffRouter := chi.NewRouter()
	staffRouter.Use(i18n.Middleware(i18n.Default()))
	staffRouter.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			next.ServeHTTP(w, r.WithContext(auth.WithPrincipal(r.Context(), auth.Principal{
				Subject: testSubject,
				Roles:   []string{auth.RoleSellerStaff},
			})))
		})
	})
	staffRouter.Route("/v1", func(r chi.Router) {
		RegisterSellerRoutes(Dependencies{Core: stub})(r)
	})

	rec := doRequest(t, staffRouter, http.MethodPost, "/v1/seller/stores/store-1/categories",
		`{"slug":"x","translations":{"en":{"name":"X"}}}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("staff create status = %d (body %q)", rec.Code, rec.Body.String())
	}

	// Malformed JSON is a 400 invalid_json before Core is ever called.
	rec = doRequest(t, staffRouter, http.MethodPost, "/v1/seller/stores/store-1/categories", `{invalid`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("invalid json status = %d (body %q)", rec.Code, rec.Body.String())
	}
	if code := decodeError(t, rec); code != "invalid_json" {
		t.Fatalf("code = %q, want invalid_json", code)
	}
}
