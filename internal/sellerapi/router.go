// Package sellerapi hosts the Seller Platform HTTP surface, including the theme
// endpoints that drive the native storefront.
//
// Every business capability is a Core-owned runtime call (ADR-017). This package
// owns request parsing, authorization of the authenticated principal, and the
// public response contract; it owns no business rules and no database access.
package sellerapi

import (
	"context"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"seller/internal/actorhttp"
	"seller/internal/audit"
	"seller/internal/coreclient"
	"seller/internal/httpx"
	"seller/internal/idempotency"
	"seller/internal/money"
	"seller/internal/ratelimit"
)

// CoreCapabilities are the Core calls the seller routes depend on. The interface
// exists so handlers can be tested against a stub Core server.
type CoreCapabilities interface {
	ResolveSeller(ctx context.Context, subject string) (string, error)
	GetSeller(ctx context.Context, sellerID, subject string) (coreclient.Seller, map[string]any, error)
	UpdateSellerProfile(ctx context.Context, sellerID, subject string, update coreclient.ProfileUpdate) (string, error)
	ListSellerStores(ctx context.Context, sellerID, subject string, page coreclient.Page) (*coreclient.SellerStoreListResponse, error)
	CreateSellerStore(ctx context.Context, sellerID, subject string, create coreclient.StoreCreate) (coreclient.Store, error)
	CreateMerchantStore(ctx context.Context, merchantID, subject string, create coreclient.StoreCreate) (coreclient.Store, error)
	EnsureRetailWorkspace(ctx context.Context, subject, code, legalName string) (coreclient.RetailWorkspace, error)
	GetStore(ctx context.Context, storeID, subject string) (coreclient.Store, error)
	UpdateStoreStatus(ctx context.Context, storeID, subject, status string) (*coreclient.Store, error)
	GetStoreOperationalState(ctx context.Context, storeID, subject string) (*coreclient.StoreOperationalState, error)
	UpdateStoreOperationalState(ctx context.Context, storeID, subject string, update coreclient.StoreOperationalStateUpdate) (*coreclient.StoreOperationalState, error)
	GetStorefrontHost(ctx context.Context, storeID, subject string) (string, error)
	ListSupplierCatalog(ctx context.Context, storeID, subject string, filter coreclient.SupplierCatalogFilter) ([]coreclient.SupplierCatalogItem, error)
	ListStoreSupplierOffers(ctx context.Context, storeID, subject string, filter coreclient.SupplierCatalogFilter) ([]coreclient.SupplierCatalogItem, error)
	ImportSupplierOffer(ctx context.Context, storeID, offerID, subject string, params ...coreclient.SupplierOfferImportParams) (*coreclient.SellerListing, error)
	ListStoreListings(ctx context.Context, storeID, subject string, page coreclient.Page) ([]coreclient.SellerListing, error)
	GetStoreListing(ctx context.Context, storeID, listingID, subject string) (*coreclient.SellerListing, error)
	GetStoreListingLifecycle(ctx context.Context, storeID, listingID, subject string) (*coreclient.SellerListingLifecycle, error)
	ImportListing(ctx context.Context, storeID, subject string, importReq coreclient.ListingImport) (coreclient.SellerListing, error)
	SetListingPrice(ctx context.Context, listingID, subject string, price coreclient.PriceUpdate) error
	SetStoreListingPrice(ctx context.Context, storeID, listingID, subject string, price coreclient.PriceUpdate) error
	GetStoreListingReadiness(ctx context.Context, storeID, listingID, subject string) (*coreclient.StructuredPublishReadiness, error)
	PublishStoreListing(ctx context.Context, storeID, listingID, subject string) (*coreclient.SellerListing, error)
	UnpublishStoreListing(ctx context.Context, storeID, listingID, subject string) (*coreclient.SellerListing, error)
	ArchiveStoreListing(ctx context.Context, storeID, listingID, subject string) (*coreclient.SellerListing, error)
	UpdateListingStatus(ctx context.Context, listingID, subject, status string) error

	// Catalog & Order Capabilities
	ListStoreProducts(ctx context.Context, subject, storeID, status, source, query string, limit, offset int) (*coreclient.SellerProductListResponse, error)
	CreateSellerProduct(ctx context.Context, subject, storeID string, draft coreclient.SellerProductDraft) (*coreclient.SellerProductDetail, error)
	GetSellerProductDetail(ctx context.Context, subject, storeID, productID string) (*coreclient.SellerProductDetail, error)
	UpdateSellerProduct(ctx context.Context, subject, storeID, productID string, slug string, translations []coreclient.SellerProductTranslation, categoryIDs []string) (*coreclient.SellerProductDetail, error)
	TransitionProductStatus(ctx context.Context, subject, storeID, productID, status string) (string, error)
	ArchiveProduct(ctx context.Context, subject, storeID, productID string) error
	CreateVariant(ctx context.Context, subject, storeID, productID, code, status string) (*coreclient.Variant, error)
	CreateVariantWithOptions(ctx context.Context, subject, storeID, productID string, params coreclient.CreateVariantParams) (*coreclient.VariantWithDetails, error)
	UpdateVariant(ctx context.Context, subject, storeID, productID, variantID, code, status string) (*coreclient.Variant, error)
	CreateSKU(ctx context.Context, subject, storeID, productID, variantID, code string, barcode *string, status string) (*coreclient.SKU, error)
	UpdateSKU(ctx context.Context, subject, storeID, productID, variantID, skuID, code string, barcode *string, status string) (*coreclient.SKU, error)
	CreateMediaUpload(ctx context.Context, subject, storeID, productID string, req coreclient.MediaUploadRequest) (*coreclient.MediaUploadResponse, error)
	CompleteMediaUpload(ctx context.Context, subject, storeID, productID string, req coreclient.CompleteMediaUploadRequest) (*coreclient.MediaMetadata, error)
	UpdateMedia(ctx context.Context, subject, storeID, productID, mediaID, altText string, sortOrder int, isPrimary bool) (*coreclient.MediaMetadata, error)
	DeleteMedia(ctx context.Context, subject, storeID, productID, mediaID string) error
	ListStoreMedia(ctx context.Context, subject, storeID, filename, contentType string, limit, offset int) (*coreclient.StoreMediaListResponse, error)
	PresignStoreMediaUpload(ctx context.Context, subject, storeID string, req coreclient.PresignMediaUploadRequest) (*coreclient.PresignMediaUploadResponse, error)
	CompleteStoreMediaUploadIntent(ctx context.Context, subject, storeID, intentID string, req coreclient.CompleteStoreMediaUploadRequest) (*coreclient.StoreMediaAsset, error)
	DeleteStoreMediaAsset(ctx context.Context, subject, storeID, assetID string) error
	ListProductMediaReferences(ctx context.Context, subject, storeID, productID string) ([]coreclient.ProductMediaReference, error)
	AttachProductMediaReference(ctx context.Context, subject, storeID, productID string, req coreclient.AttachMediaReferenceRequest) (*coreclient.ProductMediaReference, error)
	UpdateProductMediaReference(ctx context.Context, subject, storeID, productID, referenceID string, req coreclient.UpdateMediaReferenceRequest) (*coreclient.ProductMediaReference, error)
	DetachProductMediaReference(ctx context.Context, subject, storeID, productID, referenceID string) error
	ListStoreLocations(ctx context.Context, subject, storeID string) ([]coreclient.StoreLocation, error)
	CreateStoreLocation(ctx context.Context, subject, storeID, code, name, locType, status string) (*coreclient.StoreLocation, error)
	ListStoreInventory(ctx context.Context, subject, storeID string) ([]coreclient.SellerInventorySummary, error)
	CreateInventorySnapshot(ctx context.Context, subject, storeID string, req coreclient.CreateSnapshotRequest) (*coreclient.InventorySnapshot, error)
	AdjustInventory(ctx context.Context, subject, storeID, snapshotID string, req coreclient.AdjustInventoryRequest) (*coreclient.InventorySnapshot, error)
	AdjustStoreInventoryDualMode(ctx context.Context, subject, storeID string, req coreclient.DualModeAdjustmentRequest, idempotencyKey string) (*coreclient.DualModeAdjustmentResponse, error)
	GetListingPresentation(ctx context.Context, subject, storeID, listingID string) (*coreclient.SellerListingPresentation, error)
	UpdateListingPresentation(ctx context.Context, subject, storeID, listingID string, pres coreclient.SellerListingPresentation) (*coreclient.SellerListingPresentation, error)
	PublishSellerProduct(ctx context.Context, subject, storeID, productID string) error
	UnpublishSellerProduct(ctx context.Context, subject, storeID, productID string) error
	ListStoreOrders(ctx context.Context, subject, storeID, status string, limit, offset int) (*coreclient.SellerOrderListResponse, error)
	GetStoreOrderDetail(ctx context.Context, subject, storeID, orderID string) (*coreclient.SellerOrderDetail, error)
	TransitionStoreOrder(ctx context.Context, subject, storeID, orderID string, req coreclient.OrderTransitionRequest) (*coreclient.SellerOrderDetail, error)
	ListStoreCategories(ctx context.Context, subject, storeID, status string, limit, offset int) ([]coreclient.StoreCategory, error)
	CreateStoreCategory(ctx context.Context, subject, storeID string, input coreclient.StoreCategoryInput) (*coreclient.StoreCategory, error)
	GetStoreCategory(ctx context.Context, subject, storeID, categoryID string) (*coreclient.StoreCategory, error)
	UpdateStoreCategory(ctx context.Context, subject, storeID, categoryID string, input coreclient.StoreCategoryUpdateInput) (*coreclient.StoreCategory, error)
	UpdateStoreCategoryStatus(ctx context.Context, subject, storeID, categoryID, status string) (*coreclient.StoreCategory, error)
	DeleteStoreCategory(ctx context.Context, subject, storeID, categoryID string) error
	ReorderStoreCategories(ctx context.Context, subject, storeID string, order []coreclient.StoreCategoryReorderEntry) error

	CreateOrderShipment(ctx context.Context, subject, orderID string, req coreclient.CreateShipmentRequest) (*coreclient.ShipmentResponse, error)
	GetShipment(ctx context.Context, subject, shipmentID string) (*coreclient.ShipmentResponse, error)
	UpdateShipmentStatus(ctx context.Context, subject, shipmentID string, req coreclient.UpdateShipmentStatusRequest) (*coreclient.ShipmentResponse, error)
	ListOrderShipments(ctx context.Context, subject, orderID string) ([]coreclient.ShipmentResponse, error)
	ListStoreShipments(ctx context.Context, subject, storeID string, status string, page, pageSize int) (*coreclient.StoreShipmentsResponse, error)

	InitializeOrderPayment(ctx context.Context, subject, orderID string, req coreclient.InitializePaymentRequest) (*coreclient.PaymentResponse, error)
	GetPayment(ctx context.Context, subject, paymentID string) (*coreclient.PaymentResponse, error)
	GetOrderPayment(ctx context.Context, subject, orderID string) (*coreclient.PaymentResponse, error)
	UpdatePaymentStatus(ctx context.Context, subject, paymentID string, req coreclient.UpdatePaymentStatusRequest) (*coreclient.PaymentResponse, error)

	GetStoreBalance(ctx context.Context, subject, storeID string) (*coreclient.StoreBalanceResponse, error)
	ListStoreLedgerEntries(ctx context.Context, subject, storeID string) ([]coreclient.LedgerEntryResponse, error)
	ListStoreSettlements(ctx context.Context, subject, storeID string) ([]coreclient.SettlementResponse, error)
	ListStorePayouts(ctx context.Context, subject, storeID string) ([]coreclient.PayoutResponse, error)

	CreateConnection(ctx context.Context, subject string, req coreclient.CreateConnectionPayload) (*coreclient.ConnectionResponse, error)
	ListConnections(ctx context.Context, subject, actorType, actorID string) ([]coreclient.ConnectionResponse, error)
	UpsertEntityMapping(ctx context.Context, subject string, req coreclient.UpsertEntityMappingPayload) (*coreclient.EntityMappingResponse, error)
	ListEntityMappings(ctx context.Context, subject, connectionID, entityType string) ([]coreclient.EntityMappingResponse, error)

	CreateSellerSyncJob(ctx context.Context, subject, connectionID, storeID, syncType string) (*coreclient.SellerSyncJobResponse, error)
	GetSellerSyncJob(ctx context.Context, subject, jobID string) (*coreclient.SellerSyncJobResponse, error)
	ListSellerSyncJobs(ctx context.Context, subject, storeID string) ([]coreclient.SellerSyncJobResponse, error)

	CreateAPIKey(ctx context.Context, subject string, req coreclient.CreateAPIKeyPayload) (*coreclient.CreateAPIKeyResponse, error)
	AuthenticateAPIKey(ctx context.Context, rawKey string) (*coreclient.APIKeyResponse, error)
	ListAPIKeys(ctx context.Context, subject, actorType, actorID string) ([]coreclient.APIKeyResponse, error)
	RevokeAPIKey(ctx context.Context, subject, keyID, actorID string) error

	CreateWebhookSubscription(ctx context.Context, subject string, req coreclient.CreateWebhookSubscriptionPayload) (*coreclient.WebhookSubscriptionResponse, error)
	ListWebhookSubscriptions(ctx context.Context, subject, actorType, actorID string) ([]coreclient.WebhookSubscriptionResponse, error)
	DeleteWebhookSubscription(ctx context.Context, subject, subID, actorID string) error

	// Merchant Console supply read pass-throughs (Feature 025). Core performs
	// the authoritative merchant membership/capability/permission checks.
	ListSupplyConnections(ctx context.Context, subject, merchantID, connectionType string) ([]coreclient.SupplyConnection, error)
	GetSupplyConnection(ctx context.Context, subject, merchantID, connectionID string) (*coreclient.SupplyConnection, error)
	ListSupplyImportBatches(ctx context.Context, subject, merchantID, connectionID, status string, limit, offset int) ([]coreclient.SupplyImportBatch, error)
	GetSupplyImportBatch(ctx context.Context, subject, merchantID, batchID string) (*coreclient.SupplyImportBatchDetail, error)
	ListSupplyReviewCases(ctx context.Context, subject, merchantID, connectionID, status string) ([]coreclient.SupplyReviewCase, error)
	GetSupplyReviewCase(ctx context.Context, subject, merchantID, caseID string) (*coreclient.SupplyReviewCase, error)
	ListSupplyMappings(ctx context.Context, subject, merchantID, connectionID string) ([]coreclient.SupplyMapping, error)
	GetSupplyMapping(ctx context.Context, subject, merchantID, mappingID string) (*coreclient.SupplyMapping, error)
	ListSupplyCursors(ctx context.Context, subject, merchantID, connectionID string) ([]coreclient.SupplyCursor, error)
	ListSupplyFulfillmentRequests(ctx context.Context, subject, merchantID, connectionID, status string, limit, offset int) ([]coreclient.SupplyFulfillmentRequest, error)
	GetSupplyFulfillmentRequest(ctx context.Context, subject, merchantID, requestID string) (*coreclient.SupplyFulfillmentRequestDetail, error)
}

// Dependencies wires the seller routes.
type Dependencies struct {
	Core             CoreCapabilities
	Limiter          *ratelimit.Limiter
	IdempotencyStore *idempotency.Store
	AuditLogger      *audit.Logger
}

func RegisterSellerRoutes(deps Dependencies) func(r chi.Router) {
	if deps.Limiter == nil {
		deps.Limiter = ratelimit.NewLimiter(nil, 1000, 0)
	}
	if deps.IdempotencyStore == nil {
		deps.IdempotencyStore = idempotency.NewStore(nil, 0)
	}
	if deps.AuditLogger == nil {
		deps.AuditLogger = audit.NewLogger(nil)
	}

	idempotencyOpt := idempotency.Middleware(deps.IdempotencyStore, false)

	return func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(func(next http.Handler) http.Handler {
				return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.Header().Set(httpx.HeaderAPIVersion, httpx.CurrentAPIVersion)
					next.ServeHTTP(w, r)
				})
			})
			r.Use(idempotencyOpt)

			r.Get("/seller/profile", deps.handleSellerProfile)
			r.Put("/seller/profile", deps.handleSellerProfileUpdate)
			r.Get("/seller/stores", deps.handleSellerStores)
			r.Post("/seller/stores", deps.handleSellerStoreCreate)
			r.Post("/merchants/self/retail-workspace", deps.handleEnsureRetailWorkspace)
			r.Post("/merchants/{merchant_id}/stores", deps.handleMerchantStoreCreate)
			r.Post("/seller/stores/{store_id}/status", deps.handleUpdateStoreStatus)
			r.Get("/seller/stores/{store_id}/operational-state", deps.handleGetStoreOperationalState)
			r.Put("/seller/stores/{store_id}/operational-state", deps.handleUpdateStoreOperationalState)
			r.Get("/seller/stores/{store_id}/storefront-host", deps.handleGetStorefrontHost)
			r.Get("/seller/catalog/offers", deps.handleSellerCatalogOffers)
			r.Get("/seller/listings", deps.handleSellerListings)
			r.Post("/seller/listings/import", deps.handleSellerListingImport)
			r.Post("/seller/listings/{id}/price", deps.handleSellerListingPrice)
			r.Post("/seller/listings/{id}/status", deps.handleSellerListingStatus)

			// Store-Scoped Supplier Offers & Imports
			r.Get("/seller/stores/{store_id}/supplier-offers", deps.handleListStoreSupplierOffers)
			r.Post("/seller/stores/{store_id}/supplier-offers/{offer_id}/imports", deps.handleImportSupplierOffer)

			// Store-Scoped Product & Listing Routes
			r.Get("/seller/stores/{store_id}/products", deps.handleListStoreProducts)
			r.Post("/seller/stores/{store_id}/products", deps.handleCreateStoreProduct)
			r.Get("/seller/stores/{store_id}/products/{product_id}", deps.handleGetStoreProductDetail)
			r.Put("/seller/stores/{store_id}/products/{product_id}", deps.handleUpdateStoreProduct)
			r.Post("/seller/stores/{store_id}/products/{product_id}/status", deps.handleTransitionProductStatus)
			r.Post("/seller/stores/{store_id}/products/{product_id}/archive", deps.handleArchiveProduct)

			r.Post("/seller/stores/{store_id}/products/{product_id}/variants", deps.handleCreateVariant)
			r.Put("/seller/stores/{store_id}/products/{product_id}/variants/{variant_id}", deps.handleUpdateVariant)

			r.Post("/seller/stores/{store_id}/products/{product_id}/variants/{variant_id}/skus", deps.handleCreateSKU)
			r.Put("/seller/stores/{store_id}/products/{product_id}/variants/{variant_id}/skus/{sku_id}", deps.handleUpdateSKU)

			// Legacy Product Media Routes
			r.Post("/seller/stores/{store_id}/products/{product_id}/media/uploads", deps.handleCreateMediaUpload)
			r.Post("/seller/stores/{store_id}/products/{product_id}/media", deps.handleCompleteMediaUpload)
			r.Put("/seller/stores/{store_id}/products/{product_id}/media/{media_id}", deps.handleUpdateMedia)
			r.Delete("/seller/stores/{store_id}/products/{product_id}/media/{media_id}", deps.handleDeleteMedia)

			// Store Media Asset Library
			r.Get("/seller/stores/{store_id}/media", deps.handleListStoreMedia)
			r.Post("/seller/stores/{store_id}/media/uploads", deps.handlePresignStoreMediaUpload)
			r.Post("/seller/stores/{store_id}/media/uploads/{intent_id}/complete", deps.handleCompleteStoreMediaUploadIntent)
			r.Delete("/seller/stores/{store_id}/media/{asset_id}", deps.handleDeleteStoreMediaAsset)

			// Product Media References
			r.Get("/seller/stores/{store_id}/products/{product_id}/media-references", deps.handleListProductMediaReferences)
			r.Post("/seller/stores/{store_id}/products/{product_id}/media-references", deps.handleAttachProductMediaReference)
			r.Put("/seller/stores/{store_id}/products/{product_id}/media-references/{reference_id}", deps.handleUpdateProductMediaReference)
			r.Delete("/seller/stores/{store_id}/products/{product_id}/media-references/{reference_id}", deps.handleDetachProductMediaReference)

			// Store-Scoped Listings
			r.Get("/seller/stores/{store_id}/listings", deps.handleListStoreListings)
			r.Get("/seller/stores/{store_id}/listings/{listing_id}", deps.handleGetStoreListing)
			r.Get("/seller/stores/{store_id}/listings/{listing_id}/lifecycle", deps.handleGetStoreListingLifecycle)
			r.Put("/seller/stores/{store_id}/listings/{listing_id}/price", deps.handleSetStoreListingPrice)
			r.Get("/seller/stores/{store_id}/listings/{listing_id}/readiness", deps.handleGetStoreListingReadiness)
			r.Post("/seller/stores/{store_id}/listings/{listing_id}/publish", deps.handlePublishStoreListing)
			r.Post("/seller/stores/{store_id}/listings/{listing_id}/unpublish", deps.handleUnpublishStoreListing)
			r.Post("/seller/stores/{store_id}/listings/{listing_id}/archive", deps.handleArchiveStoreListing)

			r.Get("/seller/stores/{store_id}/locations", deps.handleListStoreLocations)
			r.Post("/seller/stores/{store_id}/locations", deps.handleCreateStoreLocation)
			r.Get("/seller/stores/{store_id}/inventory", deps.handleListStoreInventory)
			r.Post("/seller/stores/{store_id}/inventory/snapshots", deps.handleCreateInventorySnapshot)
			r.Post("/seller/stores/{store_id}/inventory/{snapshot_id}/adjustments", deps.handleAdjustInventory)
			r.Post("/seller/stores/{store_id}/inventory/adjustments", deps.handleAdjustStoreInventoryDualMode)

			r.Get("/seller/stores/{store_id}/listings/{listing_id}/presentation", deps.handleGetListingPresentation)
			r.Put("/seller/stores/{store_id}/listings/{listing_id}/presentation", deps.handleUpdateListingPresentation)

			r.Post("/seller/stores/{store_id}/products/{product_id}/publish", deps.handlePublishProduct)
			r.Post("/seller/stores/{store_id}/products/{product_id}/unpublish", deps.handleUnpublishProduct)

			r.Get("/seller/stores/{store_id}/orders", deps.handleListStoreOrders)
			r.Get("/seller/stores/{store_id}/orders/{order_id}", deps.handleGetStoreOrderDetail)
			r.Post("/seller/stores/{store_id}/orders/{order_id}/transition", deps.handleTransitionStoreOrder)

			// Store-Scoped Shipping Operations
			r.Get("/seller/stores/{store_id}/shipments", deps.handleListStoreShipments)
			r.Post("/seller/stores/{store_id}/shipments", deps.handleCreateStoreShipment)
			r.Post("/seller/stores/{store_id}/orders/{order_id}/shipments", deps.handleCreateShipment)
			r.Get("/seller/stores/{store_id}/orders/{order_id}/shipments", deps.handleListOrderShipments)
			r.Get("/seller/stores/{store_id}/shipments/{shipment_id}", deps.handleGetShipment)
			r.Patch("/seller/stores/{store_id}/shipments/{shipment_id}/status", deps.handleUpdateShipmentStatus)

			// Store-Scoped Payment Operations
			r.Post("/seller/stores/{store_id}/orders/{order_id}/payments", deps.handleInitializePayment)
			r.Get("/seller/stores/{store_id}/orders/{order_id}/payments", deps.handleGetOrderPayment)
			r.Get("/seller/stores/{store_id}/payments/{payment_id}", deps.handleGetPayment)
			r.Post("/seller/stores/{store_id}/payments/{payment_id}/status", deps.handleUpdatePaymentStatus)

			// Store-Scoped Financial Operations
			r.Get("/seller/stores/{store_id}/finance/balance", deps.handleGetStoreBalance)
			r.Get("/seller/stores/{store_id}/finance/ledger", deps.handleListStoreLedgerEntries)
			r.Get("/seller/stores/{store_id}/finance/settlements", deps.handleListStoreSettlements)
			r.Get("/seller/stores/{store_id}/finance/payouts", deps.handleListStorePayouts)

			// Store-Scoped Integration Operations
			r.Get("/seller/stores/{store_id}/integrations/connections", deps.handleListStoreConnections)
			r.Post("/seller/stores/{store_id}/integrations/connections", deps.handleCreateStoreConnection)
			r.Get("/seller/stores/{store_id}/integrations/mappings", deps.handleListStoreEntityMappings)
			r.Get("/seller/stores/{store_id}/integrations/sync-jobs", deps.handleListStoreSyncJobs)
			r.Post("/seller/stores/{store_id}/integrations/sync-jobs", deps.handleCreateStoreSyncJob)
			r.Get("/seller/stores/{store_id}/integrations/sync-jobs/{id}", deps.handleGetStoreSyncJob)

			r.Get("/seller/stores/{store_id}/integrations/api-keys", deps.handleListStoreAPIKeys)
			r.Post("/seller/stores/{store_id}/integrations/api-keys", deps.handleCreateStoreAPIKey)
			r.Delete("/seller/stores/{store_id}/integrations/api-keys/{id}", deps.handleRevokeStoreAPIKey)

			r.Get("/seller/stores/{store_id}/integrations/webhooks", deps.handleListStoreWebhookSubscriptions)
			r.Post("/seller/stores/{store_id}/integrations/webhooks", deps.handleCreateStoreWebhookSubscription)
			r.Delete("/seller/stores/{store_id}/integrations/webhooks/{id}", deps.handleDeleteStoreWebhookSubscription)

			// Public Integration API Gateway Endpoints
			r.Get("/public/products", deps.handlePublicListProducts)
			r.Get("/public/inventory", deps.handlePublicGetInventory)
			r.Post("/public/inventory/adjustments", deps.handlePublicAdjustInventory)
			r.Get("/public/orders", deps.handlePublicListOrders)
			r.Get("/public/orders/{order_id}", deps.handlePublicGetOrderDetail)
			r.Get("/public/orders/{order_id}/fulfillments", deps.handlePublicListOrderFulfillments)
			r.Post("/public/orders/{order_id}/fulfillments", deps.handlePublicCreateOrderFulfillment)
			r.Get("/public/shipments/{shipment_id}", deps.handlePublicGetShipment)
			r.Patch("/public/shipments/{shipment_id}/status", deps.handlePublicUpdateShipmentStatus)

			r.Get("/public/webhooks/subscriptions", deps.handlePublicListWebhookSubscriptions)
			r.Post("/public/webhooks/subscriptions", deps.handlePublicCreateWebhookSubscription)
			r.Delete("/public/webhooks/subscriptions/{id}", deps.handlePublicDeleteWebhookSubscription)

			// Store-Scoped Category Routes (seller-managed per-store categories;
			// membership and isolation enforced by Core).
			r.Get("/seller/stores/{store_id}/categories", deps.handleListStoreCategories)
			r.Post("/seller/stores/{store_id}/categories", deps.handleCreateStoreCategory)
			r.Get("/seller/stores/{store_id}/categories/{category_id}", deps.handleGetStoreCategory)
			r.Put("/seller/stores/{store_id}/categories/{category_id}", deps.handleUpdateStoreCategory)
			r.Post("/seller/stores/{store_id}/categories/{category_id}/status", deps.handleTransitionStoreCategoryStatus)
			r.Delete("/seller/stores/{store_id}/categories/{category_id}", deps.handleDeleteStoreCategory)
			r.Post("/seller/stores/{store_id}/categories/reorder", deps.handleReorderStoreCategories)
		})
	}
}

// sellerID resolves the caller's seller identity through Core. Core performs the
// resolution from the authenticated subject, so a caller cannot assert its own
// seller identifier.
func (deps Dependencies) sellerID(w http.ResponseWriter, r *http.Request) (string, string, bool) {
	subject, err := actorhttp.SubjectFrom(r)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return "", "", false
	}
	sellerID, err := deps.Core.ResolveSeller(r.Context(), subject)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return "", "", false
	}
	return subject, sellerID, true
}

func (deps Dependencies) handleSellerProfile(w http.ResponseWriter, r *http.Request) {
	_, sellerID, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	seller, settings, err := deps.Core.GetSeller(r.Context(), sellerID, actorhttp.SubjectOrEmpty(r))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, SellerProfileResponse{Seller: seller, Settings: settings})
}

func (deps Dependencies) handleSellerProfileUpdate(w http.ResponseWriter, r *http.Request) {
	subject, sellerID, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	var body SellerProfileUpdateRequest
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	status, err := deps.Core.UpdateSellerProfile(r.Context(), sellerID, subject, coreclient.ProfileUpdate{
		Name:     body.Name,
		Status:   body.Status,
		Settings: body.Settings,
	})
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": status})
}

func (deps Dependencies) handleSellerStores(w http.ResponseWriter, r *http.Request) {
	subject, sellerID, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	res, err := deps.Core.ListSellerStores(r.Context(), sellerID, subject, pageFrom(r))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (deps Dependencies) handleSellerStoreCreate(w http.ResponseWriter, r *http.Request) {
	subject, sellerID, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	var body SellerStoreCreateRequest
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	store, err := deps.Core.CreateSellerStore(r.Context(), sellerID, subject, coreclient.StoreCreate{
		MarketCode: body.MarketCode,
		Code:       body.Code,
		Name:       body.Name,
		Status:     body.Status,
		Settings:   body.Settings,
	})
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, store)
}

func (deps Dependencies) handleMerchantStoreCreate(w http.ResponseWriter, r *http.Request) {
	subject, err := actorhttp.SubjectFrom(r)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	var body SellerStoreCreateRequest
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	store, err := deps.Core.CreateMerchantStore(r.Context(), chi.URLParam(r, "merchant_id"), subject, coreclient.StoreCreate{
		MarketCode: body.MarketCode,
		Code:       body.Code,
		Name:       body.Name,
		Status:     body.Status,
		Settings:   body.Settings,
	})
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, store)
}

func (deps Dependencies) handleEnsureRetailWorkspace(w http.ResponseWriter, r *http.Request) {
	subject, err := actorhttp.SubjectFrom(r)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	var body struct {
		Code      string `json:"code"`
		LegalName string `json:"legal_name"`
	}
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	if strings.TrimSpace(body.Code) == "" || strings.TrimSpace(body.LegalName) == "" {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "invalid input")
		return
	}
	workspace, err := deps.Core.EnsureRetailWorkspace(r.Context(), subject, strings.TrimSpace(body.Code), strings.TrimSpace(body.LegalName))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, workspace)
}

// handleSellerCatalogOffers browses the supplier offers available to one of the
// seller's stores. The store is loaded through Core, which enforces ownership, so
// a seller cannot browse another seller's store by guessing an identifier.
func (deps Dependencies) handleSellerCatalogOffers(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := r.URL.Query().Get("store_id")
	if _, err := deps.Core.GetStore(r.Context(), storeID, subject); err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	filter := coreclient.SupplierCatalogFilter{
		SupplierID: r.URL.Query().Get("supplier_id"),
		CategoryID: r.URL.Query().Get("category_id"),
		Page:       pageFrom(r),
	}
	items, err := deps.Core.ListSupplierCatalog(r.Context(), storeID, subject, filter)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleSellerListings(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := r.URL.Query().Get("store_id")
	if _, err := deps.Core.GetStore(r.Context(), storeID, subject); err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	items, err := deps.Core.ListStoreListings(r.Context(), storeID, subject, pageFrom(r))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleSellerListingImport(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	var body SellerListingImportRequest
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	// The store is authorized through Core before the import is attempted.
	if _, err := deps.Core.GetStore(r.Context(), body.StoreID, subject); err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	listing, err := deps.Core.ImportListing(r.Context(), body.StoreID, subject, coreclient.ListingImport{
		ProductID:       body.ProductID,
		SupplierOfferID: body.SupplierOfferID,
		Status:          body.Status,
		MarketCode:      body.MarketCode,
	})
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, listing)
}

func (deps Dependencies) handleSellerListingPrice(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	var body SellerListingPriceRequest
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	// Validate the money shape locally so a malformed currency is a 400 rather
	// than a round trip to Core.
	if _, err := money.New(body.AmountMinor, body.Currency); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	err := deps.Core.SetListingPrice(r.Context(), chi.URLParam(r, "id"), subject, coreclient.PriceUpdate{
		AmountMinor: body.AmountMinor,
		Currency:    body.Currency,
	})
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (deps Dependencies) handleSellerListingStatus(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	if err := deps.Core.UpdateListingStatus(r.Context(), chi.URLParam(r, "id"), subject, body.Status); err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": body.Status})
}

func (deps Dependencies) handleGetStorefrontHost(w http.ResponseWriter, r *http.Request) {
	subject, err := actorhttp.SubjectFrom(r)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	storeID := chi.URLParam(r, "store_id")
	host, err := deps.Core.GetStorefrontHost(r.Context(), storeID, subject)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, StorefrontHostResponse{Host: host})
}

// pageFrom converts the shared pagination window into the Core client's shape.
func pageFrom(r *http.Request) coreclient.Page {
	page := actorhttp.ParsePage(r)
	return coreclient.Page{Limit: page.Limit, Offset: page.Offset}
}
