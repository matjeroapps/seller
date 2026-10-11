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

// The seller document must declare the variant lifecycle routes that the
// seller API registers: DELETE of an unreferenced variant and the POST
// .../archive lifecycle transition.
func TestProductVariantLifecycleRoutesAreDeclared(t *testing.T) {
	spec, err := BuildSellerSpec()
	if err != nil {
		t.Fatalf("build seller spec: %v", err)
	}

	variantPath := "/v1/seller/stores/{store_id}/products/{product_id}/variants/{variant_id}"
	item := spec.Paths.Value(variantPath)
	if item == nil || item.Delete == nil {
		t.Fatalf("seller spec missing DELETE %s", variantPath)
	}
	if item.Delete.OperationID != "deleteProductVariant" {
		t.Fatalf("DELETE variant operation id = %q, want deleteProductVariant", item.Delete.OperationID)
	}
	if !containsTag(item.Delete.Tags, "Variants") {
		t.Fatalf("DELETE variant route missing Variants tag")
	}
	if item.Delete.Security == nil || len(*item.Delete.Security) == 0 {
		t.Fatalf("DELETE variant route must require auth")
	}
	deleteResponses := item.Delete.Responses.Map()
	for _, status := range []string{"204", "404", "409"} {
		if deleteResponses[status] == nil || deleteResponses[status].Value == nil {
			t.Fatalf("DELETE variant missing %s response (responses %v)", status, deleteResponses)
		}
	}

	archivePath := "/v1/seller/stores/{store_id}/products/{product_id}/variants/{variant_id}/archive"
	archive := spec.Paths.Value(archivePath)
	if archive == nil || archive.Post == nil {
		t.Fatalf("seller spec missing POST %s", archivePath)
	}
	if archive.Post.OperationID != "archiveProductVariant" {
		t.Fatalf("archive variant operation id = %q, want archiveProductVariant", archive.Post.OperationID)
	}
	if !containsTag(archive.Post.Tags, "Variants") {
		t.Fatalf("archive variant route missing Variants tag")
	}
	if archive.Post.Security == nil || len(*archive.Post.Security) == 0 {
		t.Fatalf("archive variant route must require auth")
	}
	okResponse := archive.Post.Responses.Value("200")
	if okResponse == nil || okResponse.Value == nil || okResponse.Value.Description == nil {
		t.Fatalf("archive variant route should return 200 with an archived-variant description")
	}
	description := strings.ToLower(*okResponse.Value.Description)
	if !strings.Contains(description, "archived") || !strings.Contains(description, "variant") {
		t.Fatalf("archive variant route should return 200 with an archived-variant description")
	}

	// The declared paths must line up with the routes the seller router
	// registers, so the document cannot drift from the server surface.
	registered := map[string]map[string]string{
		variantPath: {"DELETE": "deleteProductVariant"},
		archivePath: {"POST": "archiveProductVariant"},
		"/v1/seller/stores/{store_id}/products/{product_id}/variants":                            {"POST": "createProductVariant"},
		"/v1/seller/stores/{store_id}/products/{product_id}/variants/{variant_id}":               {"PUT": "updateProductVariant"},
		"/v1/seller/stores/{store_id}/products/{product_id}/variants/{variant_id}/skus":          {"POST": "createProductSKU"},
		"/v1/seller/stores/{store_id}/products/{product_id}/variants/{variant_id}/skus/{sku_id}": {"PUT": "updateProductSKU"},
	}
	// The lifecycle table above keys off the same surface the router registers;
	// a missing entry here means the document no longer covers a variant route.
	for path, methods := range registered {
		entry := spec.Paths.Value(path)
		if entry == nil {
			t.Fatalf("seller spec missing variant path %s", path)
		}
		for method, operationID := range methods {
			operation := entry.Operations()[method]
			if operation == nil {
				t.Fatalf("seller spec path %s missing declared method %s", path, method)
			}
			if operation.OperationID != operationID {
				t.Fatalf("seller spec path %s method %s operation id = %q, want %q", path, method, operation.OperationID, operationID)
			}
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
