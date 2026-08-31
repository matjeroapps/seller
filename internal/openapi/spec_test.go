package openapi

import (
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

func containsTag(tags []string, want string) bool {
	for _, tag := range tags {
		if tag == want {
			return true
		}
	}
	return false
}
