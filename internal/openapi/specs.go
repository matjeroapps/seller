package openapi

import (
	"net/http"

	"github.com/getkin/kin-openapi/openapi3"

	"github.com/matjeroapps/core/pkg/commerce"
	"github.com/matjeroapps/core/pkg/contracts"
	"github.com/matjeroapps/seller/internal/sellerapi"
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
		Tags:          openAPITags(),
		Routes:        actorRoutes(false),
	})
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
