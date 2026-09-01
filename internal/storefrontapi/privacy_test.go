package storefrontapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// forbiddenResponseTerms must never appear in a public storefront HTTP response.
// The Core read model has its own leakage test; this one guards the HTTP contract,
// which is what a customer actually receives.
var forbiddenResponseTerms = []string{
	"supplier",
	"supplier_id",
	"supplier_code",
	"supplier_email",
	"supplier_phone",
	"contact_email",
	"wholesale",
	"cost",
	"margin",
	"fee",
	"payout",
	"fulfillment",
	"on_hand_qty",
	"reserved_qty",
	"available_qty",
	"inventory",
	"internal",
	"seller_id",
	"store_id",
	"listing_id",
	"moderation",
}

func TestStorefrontResponsesCarryNoPrivateData(t *testing.T) {
	env := setupAPITest(t)

	targets := []string{
		"/v1/storefront/store",
		"/v1/storefront/categories",
		"/v1/storefront/categories/store-a-lighting",
		"/v1/storefront/products",
		"/v1/storefront/products/store-a-desk-lamp",
		"/v1/storefront/search?q=lamp",
	}

	for _, target := range targets {
		rec, body := env.get(t, domainA, target)
		if rec.Code != http.StatusOK {
			t.Fatalf("%s: expected 200, got %d: %s", target, rec.Code, body)
		}
		lower := strings.ToLower(body)
		for _, term := range forbiddenResponseTerms {
			if strings.Contains(lower, term) {
				t.Fatalf("%s: forbidden term %q in public response: %s", target, term, body)
			}
		}
		// The supplier wholesale cost is 100.00 in minor units.
		if strings.Contains(lower, "10000") {
			t.Fatalf("%s: supplier wholesale amount leaked: %s", target, body)
		}
	}
}

// Public browsing must remain anonymous: no route may demand a bearer token.
func TestStorefrontRoutesAreAnonymous(t *testing.T) {
	env := setupAPITest(t)

	for _, target := range []string{
		"/v1/storefront/store",
		"/v1/storefront/categories",
		"/v1/storefront/products",
		"/v1/storefront/search?q=lamp",
	} {
		req := httptest.NewRequest(http.MethodGet, target, nil)
		req.Host = domainA
		rec := httptest.NewRecorder()
		env.handler.ServeHTTP(rec, req)
		if rec.Code == http.StatusUnauthorized || rec.Code == http.StatusForbidden {
			t.Fatalf("%s: public route required authentication (%d)", target, rec.Code)
		}
	}
}
