package openapi

import (
	"net/http"

	"github.com/getkin/kin-openapi/openapi3"

	"github.com/matjeroapps/core/pkg/commerce"
	"github.com/matjeroapps/core/pkg/contracts"
	"github.com/matjeroapps/seller/internal/sellerapi"
	"github.com/matjeroapps/seller/internal/storefrontapi"
)

func BuildSellerSpec() (*openapi3.T, error) {
	return BuildDocument(DocumentSpec{
		Title:         "Matjero Seller API",
		Description:   "OpenAPI contract for the Matjero Seller API.",
		Authenticated: true,
		Tags:          openAPITags(),
		Routes:        append(actorRoutes(true), sellerRoutes()...),
	})
}

func BuildStorefrontSpec() (*openapi3.T, error) {
	return BuildDocument(DocumentSpec{
		Title:         "Matjero Storefront API",
		Description:   "OpenAPI contract for the public Matjero Storefront API.",
		Authenticated: false,
		Tags:          storefrontTags(),
		Routes:        append(actorRoutes(false), storefrontRoutes()...),
	})
}

// storefrontTags is the tag catalogue of the public document. It is restricted to
// tags the public operations actually use: the shared actor catalogue also names
// supplier, seller-listing, inventory and fulfillment concerns, which a
// customer-facing contract must not describe.
func storefrontTags() []openapi3.Tag {
	public := map[string]bool{
		"Identity & Access": true,
		"Markets":           true,
		"Catalog":           true,
		"Categories":        true,
	}
	tags := make([]openapi3.Tag, 0, 8)
	for _, tag := range openAPITags() {
		if public[tag.Name] {
			tags = append(tags, tag)
		}
	}
	return append(tags,
		openapi3.Tag{Name: "Storefront", Description: "Public storefront bootstrap resolved from the request host"},
		openapi3.Tag{Name: "Products", Description: "Public product browsing and product detail"},
		openapi3.Tag{Name: "Search", Description: "Public catalog search"},
	)
}

// storefrontRoutes declares the public catalog surface. Every operation is
// anonymous (Auth false) and derives its tenant from the trusted request host, so
// no store or seller identifier appears as a parameter.
func storefrontRoutes() []RouteSpec {
	return []RouteSpec{
		{
			Method:      http.MethodGet,
			Path:        "/v1/storefront/store",
			OperationID: "getStorefrontStore",
			Summary:     "Load public storefront context",
			Description: "Returns the public store identity, market, currency, locales, public settings, and the published theme for the store resolved from the request host. Draft theme configuration is never returned.",
			Tags:        []string{"Storefront"},
			Responses:   storefrontResponses("Public storefront context", storefrontapi.StoreResponse{}),
		},
		{
			Method:      http.MethodGet,
			Path:        "/v1/storefront/categories",
			OperationID: "listStorefrontCategories",
			Summary:     "List public categories",
			Description: "Returns the public category tree for the resolved store. Each node carries its parent slug so a client can rebuild the hierarchy.",
			Tags:        []string{"Storefront", "Categories"},
			Responses:   storefrontResponses("Public category collection", storefrontapi.CategoryCollectionResponse{}),
		},
		{
			Method:      http.MethodGet,
			Path:        "/v1/storefront/categories/{slug}",
			OperationID: "getStorefrontCategory",
			Summary:     "Get a public category by slug",
			Description: "Resolves a category slug within the store resolved from the request host. A slug belonging to another store returns 404.",
			Tags:        []string{"Storefront", "Categories"},
			Parameters:  []ParameterSpec{pathStringParam("slug", "Public category slug")},
			Responses:   storefrontResponses("Public category", storefrontapi.CategoryResponse{}),
		},
		{
			Method:      http.MethodGet,
			Path:        "/v1/storefront/products",
			OperationID: "listStorefrontProducts",
			Summary:     "Browse public products",
			Description: "Returns a bounded page of publicly listed products for the resolved store. Prices are seller listing prices in the store market currency.",
			Tags:        []string{"Storefront", "Catalog", "Products"},
			Parameters:  catalogBrowseParams(),
			Responses:   storefrontResponses("Public product collection", storefrontapi.ProductCollectionResponse{}),
		},
		{
			Method:      http.MethodGet,
			Path:        "/v1/storefront/products/{slug}",
			OperationID: "getStorefrontProduct",
			Summary:     "Get a public product by slug",
			Description: "Resolves a product slug within the store resolved from the request host. A slug not publicly listed by this store returns 404.",
			Tags:        []string{"Storefront", "Products"},
			Parameters:  []ParameterSpec{pathStringParam("slug", "Public product slug")},
			Responses:   storefrontResponses("Public product detail", storefrontapi.ProductResponse{}),
		},
		{
			Method:      http.MethodGet,
			Path:        "/v1/storefront/search",
			OperationID: "searchStorefrontProducts",
			Summary:     "Search public products",
			Description: "Keyword search across localized product name, description and slug, scoped to the resolved store. Accepts the same filters, sort and pagination as product browsing.",
			Tags:        []string{"Storefront", "Search", "Catalog"},
			Parameters:  catalogBrowseParams(),
			Responses:   storefrontResponses("Public search results", storefrontapi.ProductCollectionResponse{}),
		},
	}
}

// catalogBrowseParams declares the shared browse/search query contract. Filters are
// domain-neutral: prices are minor-unit integers and sort values are stable names,
// not storage-specific expressions.
func catalogBrowseParams() []ParameterSpec {
	return []ParameterSpec{
		stringParam("q", "Keyword matched against localized product name, description and slug", false),
		stringParam("category", "Filter by public category slug", false),
		{Name: "min_price", In: "query", Description: "Minimum price in currency minor units", Schema: int64(0)},
		{Name: "max_price", In: "query", Description: "Maximum price in currency minor units", Schema: int64(0)},
		stringParam("availability", "Filter by derived availability: in_stock or out_of_stock", false),
		stringParam("sort", "Sort order: newest, price_asc, price_desc or name_asc", false),
		{Name: "limit", In: "query", Description: "Page size, default 24, maximum 60", Schema: int64(0)},
		offsetParam(),
	}
}

// storefrontResponses is the public response set. Public browsing is anonymous, so
// there is no 401/403; 404 covers unknown host, unavailable store, and unknown or
// cross-store slugs with one generic body.
func storefrontResponses(description string, body any) []ResponseSpec {
	return []ResponseSpec{
		okResponse(description, body),
		errorResponse(http.StatusBadRequest, "Invalid query parameters"),
		errorResponse(http.StatusNotFound, "Storefront or resource not available"),
		errorResponse(http.StatusInternalServerError, "Internal error"),
	}
}

func sellerRoutes() []RouteSpec {
	return []RouteSpec{
		{
			Method:      http.MethodGet,
			Path:        "/v1/seller/profile",
			OperationID: "getSellerProfile",
			Summary:     "Get the seller profile",
			Tags:        []string{"Sellers"},
			Auth:        true,
			Responses:   authReadResponses("Seller profile", sellerapi.SellerProfileResponse{}),
		},
		{
			Method:      http.MethodPut,
			Path:        "/v1/seller/profile",
			OperationID: "updateSellerProfile",
			Summary:     "Update the seller profile",
			Tags:        []string{"Sellers"},
			Auth:        true,
			RequestBody: sellerapi.SellerProfileUpdateRequest{},
			Responses:   authOKResponses("Seller profile updated", contracts.StatusResponse{}),
		},
		{
			Method:      http.MethodGet,
			Path:        "/v1/seller/stores",
			OperationID: "listSellerStores",
			Summary:     "List seller stores",
			Tags:        []string{"Stores"},
			Auth:        true,
			Parameters:  []ParameterSpec{limitParam(), offsetParam()},
			Responses:   listResponses[commerce.Store]("Store collection"),
		},
		{
			Method:      http.MethodPost,
			Path:        "/v1/seller/stores",
			OperationID: "createSellerStore",
			Summary:     "Create a seller store",
			Tags:        []string{"Stores"},
			Auth:        true,
			RequestBody: sellerapi.SellerStoreCreateRequest{},
			Responses:   authCreatedResponses("Store created", commerce.Store{}),
		},
		{
			Method:      http.MethodGet,
			Path:        "/v1/seller/catalog/offers",
			OperationID: "listSellerCatalogOffers",
			Summary:     "List supplier catalog offers",
			Tags:        []string{"Catalog", "Supplier Offers"},
			Auth:        true,
			Parameters: []ParameterSpec{
				stringParam("store_id", "Store identifier", true),
				stringParam("supplier_id", "Filter by supplier identifier", false),
				stringParam("category_id", "Filter by category identifier", false),
				limitParam(),
				offsetParam(),
			},
			Responses: listResponses[commerce.SupplierCatalogItem]("Supplier catalog collection"),
		},
		{
			Method:      http.MethodGet,
			Path:        "/v1/seller/listings",
			OperationID: "listSellerListings",
			Summary:     "List seller listings",
			Tags:        []string{"Seller Listings"},
			Auth:        true,
			Parameters: []ParameterSpec{
				stringParam("store_id", "Store identifier", true),
				limitParam(),
				offsetParam(),
			},
			Responses: listResponses[commerce.SellerListing]("Seller listing collection"),
		},
		{
			Method:      http.MethodPost,
			Path:        "/v1/seller/listings/import",
			OperationID: "importSellerListing",
			Summary:     "Import a supplier offer as a seller listing",
			Tags:        []string{"Seller Listings"},
			Auth:        true,
			RequestBody: sellerapi.SellerListingImportRequest{},
			Responses:   authCreatedResponses("Seller listing imported", commerce.SellerListing{}),
		},
		{
			Method:      http.MethodPost,
			Path:        "/v1/seller/listings/{id}/price",
			OperationID: "updateSellerListingPrice",
			Summary:     "Update seller listing price",
			Tags:        []string{"Seller Listings"},
			Auth:        true,
			Parameters:  []ParameterSpec{pathStringParam("id", "Seller listing identifier")},
			RequestBody: sellerapi.SellerListingPriceRequest{},
			Responses:   authOKResponses("Seller listing price updated", contracts.StatusResponse{}),
		},
		{
			Method:      http.MethodPost,
			Path:        "/v1/seller/listings/{id}/status",
			OperationID: "updateSellerListingStatus",
			Summary:     "Update seller listing status",
			Tags:        []string{"Seller Listings", "Audit"},
			Auth:        true,
			Parameters:  []ParameterSpec{pathStringParam("id", "Seller listing identifier")},
			RequestBody: contracts.StatusUpdateRequest{},
			Responses:   authOKResponses("Seller listing status updated", contracts.StatusResponse{}),
		},
		{
			Method:      http.MethodGet,
			Path:        "/v1/seller/themes",
			OperationID: "listThemes",
			Summary:     "List available themes",
			Tags:        []string{"Themes"},
			Auth:        true,
			Responses:   authReadResponses("Theme collection", sellerapi.ThemeCollectionResponse{}),
		},
		{
			Method:      http.MethodGet,
			Path:        "/v1/seller/themes/{key}/versions",
			OperationID: "listThemeVersions",
			Summary:     "List versions for a theme",
			Tags:        []string{"Themes"},
			Auth:        true,
			Parameters:  []ParameterSpec{pathStringParam("key", "Theme key")},
			Responses:   authReadResponses("Theme version collection", sellerapi.ThemeVersionCollectionResponse{}),
		},
		{
			Method:      http.MethodGet,
			Path:        "/v1/seller/stores/{store_id}/theme",
			OperationID: "getStoreTheme",
			Summary:     "Get the active theme installation and configuration for a store",
			Tags:        []string{"Themes", "Theme Configuration"},
			Auth:        true,
			Parameters:  []ParameterSpec{pathStringParam("store_id", "Store identifier")},
			Responses:   authReadResponses("Theme installation", sellerapi.ThemeInstallationResponse{}),
		},
		{
			Method:      http.MethodPost,
			Path:        "/v1/seller/stores/{store_id}/theme/install",
			OperationID: "installStoreTheme",
			Summary:     "Install or select a theme for a store",
			Tags:        []string{"Themes"},
			Auth:        true,
			Parameters:  []ParameterSpec{pathStringParam("store_id", "Store identifier")},
			RequestBody: sellerapi.ThemeInstallRequest{},
			Responses:   authCreatedResponses("Theme installed", sellerapi.ThemeInstallationResponse{}),
		},
		{
			Method:      http.MethodGet,
			Path:        "/v1/seller/stores/{store_id}/theme/draft",
			OperationID: "getStoreThemeDraft",
			Summary:     "Get the draft theme configuration for a store",
			Tags:        []string{"Theme Configuration"},
			Auth:        true,
			Parameters:  []ParameterSpec{pathStringParam("store_id", "Store identifier")},
			Responses:   authReadResponses("Draft configuration", sellerapi.ThemeDraftResponse{}),
		},
		{
			Method:      http.MethodPut,
			Path:        "/v1/seller/stores/{store_id}/theme/draft",
			OperationID: "updateStoreThemeDraft",
			Summary:     "Update the draft theme configuration for a store",
			Tags:        []string{"Theme Configuration"},
			Auth:        true,
			Parameters:  []ParameterSpec{pathStringParam("store_id", "Store identifier")},
			RequestBody: sellerapi.ThemeConfigRequest{},
			Responses:   authOKResponses("Draft configuration updated", sellerapi.ThemeDraftResponse{}),
		},
		{
			Method:      http.MethodPost,
			Path:        "/v1/seller/stores/{store_id}/theme/publish",
			OperationID: "publishStoreTheme",
			Summary:     "Publish the draft theme configuration for a store",
			Tags:        []string{"Theme Configuration"},
			Auth:        true,
			Parameters:  []ParameterSpec{pathStringParam("store_id", "Store identifier")},
			Responses:   authOKResponses("Theme published", sellerapi.ThemePublishResponse{}),
		},
		{
			Method:      http.MethodPost,
			Path:        "/v1/seller/stores/{store_id}/theme/discard",
			OperationID: "discardStoreThemeDraft",
			Summary:     "Discard the draft and reset it to the published configuration",
			Tags:        []string{"Theme Configuration"},
			Auth:        true,
			Parameters:  []ParameterSpec{pathStringParam("store_id", "Store identifier")},
			Responses:   authOKResponses("Draft discarded", sellerapi.ThemeDraftResponse{}),
		},
		{
			Method:      http.MethodPost,
			Path:        "/v1/seller/stores/{store_id}/theme/upgrade",
			OperationID: "upgradeStoreTheme",
			Summary:     "Upgrade a store's theme installation to a newer published version",
			Tags:        []string{"Themes"},
			Auth:        true,
			Parameters:  []ParameterSpec{pathStringParam("store_id", "Store identifier")},
			RequestBody: sellerapi.ThemeUpgradeRequest{},
			Responses:   authOKResponses("Theme upgraded", contracts.StatusResponse{}),
		},
		{
			Method:      http.MethodPost,
			Path:        "/v1/seller/stores/{store_id}/theme/preview",
			OperationID: "createStoreThemePreview",
			Summary:     "Issue a short-lived, signed, store-scoped preview token for the draft",
			Tags:        []string{"Theme Configuration"},
			Auth:        true,
			Parameters:  []ParameterSpec{pathStringParam("store_id", "Store identifier")},
			Responses:   authOKResponses("Preview token issued", sellerapi.ThemePreviewResponse{}),
		},
	}
}
