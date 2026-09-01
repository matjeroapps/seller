package openapi

import (
	"net/http"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
)

func TestBuildDocumentsValidate(t *testing.T) {
	specs := []struct {
		name  string
		build func() (*openapi3.T, error)
	}{
		{name: "seller", build: BuildSellerSpec},
		{name: "storefront", build: BuildStorefrontSpec},
	}

	for _, tc := range specs {
		t.Run(tc.name, func(t *testing.T) {
			spec, err := tc.build()
			if err != nil {
				t.Fatalf("build spec: %v", err)
			}
			if err := ValidateDocument(spec); err != nil {
				t.Fatalf("validate spec: %v", err)
			}
		})
	}
}

func TestBuildDocumentsDeterministic(t *testing.T) {
	specs := []struct {
		name  string
		build func() (*openapi3.T, error)
	}{
		{name: "seller", build: BuildSellerSpec},
		{name: "storefront", build: BuildStorefrontSpec},
	}

	for _, tc := range specs {
		t.Run(tc.name, func(t *testing.T) {
			first, err := tc.build()
			if err != nil {
				t.Fatalf("build first spec: %v", err)
			}
			firstBytes, err := MarshalDocument(first)
			if err != nil {
				t.Fatalf("marshal first spec: %v", err)
			}

			second, err := tc.build()
			if err != nil {
				t.Fatalf("build second spec: %v", err)
			}
			secondBytes, err := MarshalDocument(second)
			if err != nil {
				t.Fatalf("marshal second spec: %v", err)
			}

			if string(firstBytes) != string(secondBytes) {
				t.Fatalf("spec generation is not deterministic")
			}
		})
	}
}

func TestSecuritySchemes(t *testing.T) {
	authSpecs := []struct {
		name  string
		build func() (*openapi3.T, error)
	}{
		{name: "seller", build: BuildSellerSpec},
	}

	for _, tc := range authSpecs {
		t.Run(tc.name, func(t *testing.T) {
			spec, err := tc.build()
			if err != nil {
				t.Fatalf("build spec: %v", err)
			}
			if spec.Components == nil || spec.Components.SecuritySchemes == nil {
				t.Fatalf("missing security schemes")
			}
			if _, ok := spec.Components.SecuritySchemes["bearerAuth"]; !ok {
				t.Fatalf("bearerAuth scheme missing")
			}
		})
	}
}

func TestStorefrontSpecIsPublic(t *testing.T) {
	publicSpec, err := BuildStorefrontSpec()
	if err != nil {
		t.Fatalf("build storefront spec: %v", err)
	}
	if publicSpec.Components != nil && len(publicSpec.Components.SecuritySchemes) != 0 {
		t.Fatalf("storefront spec should not declare bearer auth")
	}
	bootstrapPath := publicSpec.Paths.Value("/v1/bootstrap")
	if bootstrapPath == nil || bootstrapPath.Get == nil {
		t.Fatalf("storefront bootstrap route missing")
	}
	if bootstrapPath.Get.Security != nil {
		t.Fatalf("storefront bootstrap should be public")
	}
}

func TestImportantRoutes(t *testing.T) {
	sellerSpec, err := BuildSellerSpec()
	if err != nil {
		t.Fatalf("build seller spec: %v", err)
	}
	catalogPath := sellerSpec.Paths.Value("/v1/seller/catalog/offers")
	if catalogPath == nil || catalogPath.Get == nil {
		t.Fatalf("seller catalog route missing")
	}
	if !containsTag(catalogPath.Get.Tags, "Catalog") {
		t.Fatalf("seller catalog route missing Catalog tag")
	}
}

func TestStorefrontCatalogRoutesArePublic(t *testing.T) {
	spec, err := BuildStorefrontSpec()
	if err != nil {
		t.Fatalf("build storefront spec: %v", err)
	}

	routes := []string{
		"/v1/storefront/store",
		"/v1/storefront/categories",
		"/v1/storefront/categories/{slug}",
		"/v1/storefront/products",
		"/v1/storefront/products/{slug}",
		"/v1/storefront/search",
	}
	for _, path := range routes {
		item := spec.Paths.Value(path)
		if item == nil || item.Get == nil {
			t.Fatalf("%s missing from the storefront spec", path)
		}
		if item.Get.Security != nil {
			t.Fatalf("%s must not require authentication", path)
		}
		if !containsTag(item.Get.Tags, "Storefront") {
			t.Fatalf("%s missing the Storefront tag", path)
		}
		for _, status := range []int{http.StatusOK, http.StatusBadRequest, http.StatusNotFound} {
			if item.Get.Responses.Status(status) == nil {
				t.Fatalf("%s missing a %d response", path, status)
			}
		}
	}

	browse := spec.Paths.Value("/v1/storefront/products").Get
	for _, name := range []string{"q", "category", "min_price", "max_price", "availability", "sort", "limit", "offset"} {
		if browse.Parameters.GetByInAndName("query", name) == nil {
			t.Fatalf("browse parameter %q not documented", name)
		}
	}
	// Tenant comes from the request host, so a store or seller selector must never
	// be part of the public contract.
	for _, name := range []string{"store_id", "seller_id"} {
		if browse.Parameters.GetByInAndName("query", name) != nil {
			t.Fatalf("public contract exposes a tenant selector %q", name)
		}
	}
}

// The public document must not describe supplier, listing, inventory or
// fulfillment concerns, even in its tag catalogue.
func TestStorefrontSpecOmitsPrivateVocabulary(t *testing.T) {
	spec, err := BuildStorefrontSpec()
	if err != nil {
		t.Fatalf("build storefront spec: %v", err)
	}
	encoded, err := MarshalDocument(spec)
	if err != nil {
		t.Fatalf("marshal storefront spec: %v", err)
	}
	lower := strings.ToLower(string(encoded))
	for _, term := range []string{
		"supplier", "wholesale", "margin", "payout", "fulfillment",
		"on_hand", "reserved_qty", "available_qty", "seller_id", "store_id",
	} {
		if strings.Contains(lower, term) {
			t.Fatalf("storefront spec contains private term %q", term)
		}
	}
}

func containsTag(tags []string, want string) bool {
	for _, tag := range tags {
		if tag == want {
			return true
		}
	}
	return false
}
