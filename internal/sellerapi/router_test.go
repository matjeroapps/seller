package sellerapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"seller/internal/auth"
	"seller/internal/coreclient"
	"seller/internal/i18n"
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

func (s *stubCore) ListSellerStores(ctx context.Context, sellerID, subject string, page coreclient.Page) (*coreclient.SellerStoreListResponse, error) {
	s.sellerID, s.subject, s.page = sellerID, subject, page
	return &coreclient.SellerStoreListResponse{Items: s.stores, ActiveStoreLimit: 1, ActiveStoreCount: 1}, s.err
}

func (s *stubCore) CreateSellerStore(ctx context.Context, sellerID, subject string, create coreclient.StoreCreate) (coreclient.Store, error) {
	s.sellerID, s.subject = sellerID, subject
	return s.store, s.err
}

func (s *stubCore) GetStore(ctx context.Context, storeID, subject string) (coreclient.Store, error) {
	s.storeID, s.subject = storeID, subject
	return s.store, s.err
}

func (s *stubCore) UpdateStoreStatus(ctx context.Context, storeID, subject, status string) (*coreclient.Store, error) {
	s.storeID, s.subject = storeID, subject
	return &s.store, s.err
}

func (s *stubCore) ListSupplierCatalog(ctx context.Context, storeID, subject string, filter coreclient.SupplierCatalogFilter) ([]coreclient.SupplierCatalogItem, error) {
	s.storeID, s.subject, s.page = storeID, subject, filter.Page
	return s.catalog, s.err
}

func (s *stubCore) ListStoreSupplierOffers(ctx context.Context, storeID, subject string, filter coreclient.SupplierCatalogFilter) ([]coreclient.SupplierCatalogItem, error) {
	s.storeID, s.subject, s.page = storeID, subject, filter.Page
	return s.catalog, s.err
}

func (s *stubCore) ImportSupplierOffer(ctx context.Context, storeID, offerID, subject string) (*coreclient.SellerListing, error) {
	s.storeID, s.subject = storeID, subject
	return &s.listing, s.err
}

func (s *stubCore) ListStoreListings(ctx context.Context, storeID, subject string, page coreclient.Page) ([]coreclient.SellerListing, error) {
	s.storeID, s.subject, s.page = storeID, subject, page
	return s.listings, s.err
}

func (s *stubCore) GetStoreListing(ctx context.Context, storeID, listingID, subject string) (*coreclient.SellerListing, error) {
	s.storeID, s.subject = storeID, subject
	return &s.listing, s.err
}

func (s *stubCore) ImportListing(ctx context.Context, storeID, subject string, importReq coreclient.ListingImport) (coreclient.SellerListing, error) {
	s.storeID, s.subject = storeID, subject
	return s.listing, s.err
}

func (s *stubCore) SetListingPrice(ctx context.Context, listingID, subject string, price coreclient.PriceUpdate) error {
	s.subject = subject
	return s.err
}

func (s *stubCore) SetStoreListingPrice(ctx context.Context, storeID, listingID, subject string, price coreclient.PriceUpdate) error {
	s.storeID, s.subject = storeID, subject
	return s.err
}

func (s *stubCore) GetStoreListingReadiness(ctx context.Context, storeID, listingID, subject string) (*coreclient.StructuredPublishReadiness, error) {
	s.storeID, s.subject = storeID, subject
	return &coreclient.StructuredPublishReadiness{IsReady: true}, s.err
}

func (s *stubCore) PublishStoreListing(ctx context.Context, storeID, listingID, subject string) (*coreclient.SellerListing, error) {
	s.storeID, s.subject = storeID, subject
	return &s.listing, s.err
}

func (s *stubCore) UnpublishStoreListing(ctx context.Context, storeID, listingID, subject string) (*coreclient.SellerListing, error) {
	s.storeID, s.subject = storeID, subject
	return &s.listing, s.err
}

func (s *stubCore) ArchiveStoreListing(ctx context.Context, storeID, listingID, subject string) (*coreclient.SellerListing, error) {
	s.storeID, s.subject = storeID, subject
	return &s.listing, s.err
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

func (s *stubCore) ListStoreProducts(ctx context.Context, subject, storeID, status, source, query string, limit, offset int) (*coreclient.SellerProductListResponse, error) {
	return &coreclient.SellerProductListResponse{}, s.err
}
func (s *stubCore) CreateSellerProduct(ctx context.Context, subject, storeID string, draft coreclient.SellerProductDraft) (*coreclient.SellerProductDetail, error) {
	return &coreclient.SellerProductDetail{}, s.err
}
func (s *stubCore) GetSellerProductDetail(ctx context.Context, subject, storeID, productID string) (*coreclient.SellerProductDetail, error) {
	return &coreclient.SellerProductDetail{}, s.err
}
func (s *stubCore) UpdateSellerProduct(ctx context.Context, subject, storeID, productID string, slug string, translations []coreclient.SellerProductTranslation, categoryIDs []string) (*coreclient.SellerProductDetail, error) {
	return &coreclient.SellerProductDetail{}, s.err
}
func (s *stubCore) TransitionProductStatus(ctx context.Context, subject, storeID, productID, status string) (string, error) {
	return status, s.err
}
func (s *stubCore) ArchiveProduct(ctx context.Context, subject, storeID, productID string) error {
	return s.err
}
func (s *stubCore) CreateVariant(ctx context.Context, subject, storeID, productID, code, status string) (*coreclient.Variant, error) {
	return &coreclient.Variant{}, s.err
}
func (s *stubCore) UpdateVariant(ctx context.Context, subject, storeID, productID, variantID, code, status string) (*coreclient.Variant, error) {
	return &coreclient.Variant{}, s.err
}
func (s *stubCore) CreateSKU(ctx context.Context, subject, storeID, productID, variantID, code string, barcode *string, status string) (*coreclient.SKU, error) {
	return &coreclient.SKU{}, s.err
}
func (s *stubCore) UpdateSKU(ctx context.Context, subject, storeID, productID, variantID, skuID, code string, barcode *string, status string) (*coreclient.SKU, error) {
	return &coreclient.SKU{}, s.err
}
func (s *stubCore) CreateMediaUpload(ctx context.Context, subject, storeID, productID string, req coreclient.MediaUploadRequest) (*coreclient.MediaUploadResponse, error) {
	return &coreclient.MediaUploadResponse{}, s.err
}
func (s *stubCore) CompleteMediaUpload(ctx context.Context, subject, storeID, productID string, req coreclient.CompleteMediaUploadRequest) (*coreclient.MediaMetadata, error) {
	return &coreclient.MediaMetadata{}, s.err
}
func (s *stubCore) UpdateMedia(ctx context.Context, subject, storeID, productID, mediaID, altText string, sortOrder int, isPrimary bool) (*coreclient.MediaMetadata, error) {
	return &coreclient.MediaMetadata{}, s.err
}
func (s *stubCore) DeleteMedia(ctx context.Context, subject, storeID, productID, mediaID string) error {
	return s.err
}
func (s *stubCore) ListStoreMedia(ctx context.Context, subject, storeID, filename, contentType string, limit, offset int) (*coreclient.StoreMediaListResponse, error) {
	return &coreclient.StoreMediaListResponse{}, s.err
}
func (s *stubCore) PresignStoreMediaUpload(ctx context.Context, subject, storeID string, req coreclient.PresignMediaUploadRequest) (*coreclient.PresignMediaUploadResponse, error) {
	return &coreclient.PresignMediaUploadResponse{Mode: "upload"}, s.err
}
func (s *stubCore) CompleteStoreMediaUploadIntent(ctx context.Context, subject, storeID, intentID string, req coreclient.CompleteStoreMediaUploadRequest) (*coreclient.StoreMediaAsset, error) {
	return &coreclient.StoreMediaAsset{}, s.err
}
func (s *stubCore) DeleteStoreMediaAsset(ctx context.Context, subject, storeID, assetID string) error {
	return s.err
}
func (s *stubCore) ListProductMediaReferences(ctx context.Context, subject, storeID, productID string) ([]coreclient.ProductMediaReference, error) {
	return nil, s.err
}
func (s *stubCore) AttachProductMediaReference(ctx context.Context, subject, storeID, productID string, req coreclient.AttachMediaReferenceRequest) (*coreclient.ProductMediaReference, error) {
	return &coreclient.ProductMediaReference{}, s.err
}
func (s *stubCore) UpdateProductMediaReference(ctx context.Context, subject, storeID, productID, referenceID string, req coreclient.UpdateMediaReferenceRequest) (*coreclient.ProductMediaReference, error) {
	return &coreclient.ProductMediaReference{}, s.err
}
func (s *stubCore) DetachProductMediaReference(ctx context.Context, subject, storeID, productID, referenceID string) error {
	return s.err
}
func (s *stubCore) ListStoreLocations(ctx context.Context, subject, storeID string) ([]coreclient.StoreLocation, error) {
	return nil, s.err
}
func (s *stubCore) CreateStoreLocation(ctx context.Context, subject, storeID, code, name, locType, status string) (*coreclient.StoreLocation, error) {
	return &coreclient.StoreLocation{}, s.err
}
func (s *stubCore) ListStoreInventory(ctx context.Context, subject, storeID string) ([]coreclient.SellerInventorySummary, error) {
	return nil, s.err
}
func (s *stubCore) CreateInventorySnapshot(ctx context.Context, subject, storeID string, req coreclient.CreateSnapshotRequest) (*coreclient.InventorySnapshot, error) {
	return &coreclient.InventorySnapshot{}, s.err
}
func (s *stubCore) AdjustInventory(ctx context.Context, subject, storeID, snapshotID string, req coreclient.AdjustInventoryRequest) (*coreclient.InventorySnapshot, error) {
	return &coreclient.InventorySnapshot{}, s.err
}
func (s *stubCore) GetListingPresentation(ctx context.Context, subject, storeID, listingID string) (*coreclient.SellerListingPresentation, error) {
	return &coreclient.SellerListingPresentation{}, s.err
}
func (s *stubCore) UpdateListingPresentation(ctx context.Context, subject, storeID, listingID string, pres coreclient.SellerListingPresentation) (*coreclient.SellerListingPresentation, error) {
	return &coreclient.SellerListingPresentation{}, s.err
}
func (s *stubCore) PublishSellerProduct(ctx context.Context, subject, storeID, productID string) error {
	return s.err
}
func (s *stubCore) UnpublishSellerProduct(ctx context.Context, subject, storeID, productID string) error {
	return s.err
}
func (s *stubCore) ListStoreOrders(ctx context.Context, subject, storeID, status string, limit, offset int) (*coreclient.SellerOrderListResponse, error) {
	return &coreclient.SellerOrderListResponse{}, s.err
}
func (s *stubCore) GetStoreOrderDetail(ctx context.Context, subject, storeID, orderID string) (*coreclient.SellerOrderDetail, error) {
	return &coreclient.SellerOrderDetail{}, s.err
}
func (s *stubCore) TransitionStoreOrder(ctx context.Context, subject, storeID, orderID string, req coreclient.OrderTransitionRequest) (*coreclient.SellerOrderDetail, error) {
	return &coreclient.SellerOrderDetail{}, s.err
}
func (s *stubCore) ListCategories(ctx context.Context, subject string, limit, offset int) ([]coreclient.SellerCategory, error) {
	return nil, s.err
}
func (s *stubCore) CreateOrderShipment(ctx context.Context, subject, orderID string, req coreclient.CreateShipmentRequest) (*coreclient.ShipmentResponse, error) {
	s.subject = subject
	return &coreclient.ShipmentResponse{ID: "shp_test_1", OrderID: orderID, Status: "PENDING"}, s.err
}
func (s *stubCore) GetShipment(ctx context.Context, subject, shipmentID string) (*coreclient.ShipmentResponse, error) {
	s.subject = subject
	return &coreclient.ShipmentResponse{ID: shipmentID, Status: "PENDING"}, s.err
}
func (s *stubCore) UpdateShipmentStatus(ctx context.Context, subject, shipmentID string, req coreclient.UpdateShipmentStatusRequest) (*coreclient.ShipmentResponse, error) {
	s.subject = subject
	return &coreclient.ShipmentResponse{ID: shipmentID, Status: req.Status}, s.err
}
func (s *stubCore) ListOrderShipments(ctx context.Context, subject, orderID string) ([]coreclient.ShipmentResponse, error) {
	s.subject = subject
	return []coreclient.ShipmentResponse{{ID: "shp_test_1", OrderID: orderID, Status: "PENDING"}}, s.err
}

func (s *stubCore) InitializeOrderPayment(ctx context.Context, subject, orderID string, req coreclient.InitializePaymentRequest) (*coreclient.PaymentResponse, error) {
	s.subject = subject
	return &coreclient.PaymentResponse{ID: "pay_test_1", OrderID: orderID, AmountMinor: req.AmountMinor, Currency: req.Currency, PaymentMethod: req.PaymentMethod, Status: "CREATED"}, s.err
}

func (s *stubCore) GetPayment(ctx context.Context, subject, paymentID string) (*coreclient.PaymentResponse, error) {
	s.subject = subject
	return &coreclient.PaymentResponse{ID: paymentID, OrderID: "ord_1", Status: "CREATED"}, s.err
}

func (s *stubCore) GetOrderPayment(ctx context.Context, subject, orderID string) (*coreclient.PaymentResponse, error) {
	s.subject = subject
	return &coreclient.PaymentResponse{ID: "pay_test_1", OrderID: orderID, Status: "CREATED"}, s.err
}

func (s *stubCore) UpdatePaymentStatus(ctx context.Context, subject, paymentID string, req coreclient.UpdatePaymentStatusRequest) (*coreclient.PaymentResponse, error) {
	s.subject = subject
	return &coreclient.PaymentResponse{ID: paymentID, Status: req.Status}, s.err
}

func (s *stubCore) GetStoreBalance(ctx context.Context, subject, storeID string) (*coreclient.StoreBalanceResponse, error) {
	s.subject = subject
	return &coreclient.StoreBalanceResponse{AvailableMinor: 150000, PendingMinor: 25000, Currency: "SAR"}, s.err
}

func (s *stubCore) ListStoreLedgerEntries(ctx context.Context, subject, storeID string) ([]coreclient.LedgerEntryResponse, error) {
	s.subject = subject
	return []coreclient.LedgerEntryResponse{{ID: "ent-1", ReferenceType: "ORDER", ReferenceID: "ord-1", Currency: "SAR"}}, s.err
}

func (s *stubCore) ListStoreSettlements(ctx context.Context, subject, storeID string) ([]coreclient.SettlementResponse, error) {
	s.subject = subject
	return []coreclient.SettlementResponse{{ID: "stl-1", AccountID: storeID, NetAmountMinor: 145000, Currency: "SAR", Status: "CALCULATED"}}, s.err
}

func (s *stubCore) ListStorePayouts(ctx context.Context, subject, storeID string) ([]coreclient.PayoutResponse, error) {
	s.subject = subject
	return []coreclient.PayoutResponse{{ID: "po-1", StoreID: storeID, AmountMinor: 100000, Currency: "SAR", Status: "DISBURSED"}}, s.err
}

func (s *stubCore) CreateConnection(ctx context.Context, subject string, req coreclient.CreateConnectionPayload) (*coreclient.ConnectionResponse, error) {
	s.subject = subject
	return &coreclient.ConnectionResponse{ID: "conn_test_1", ActorType: req.ActorType, ActorID: req.ActorID, Provider: req.Provider, Name: req.Name, Status: "active"}, s.err
}

func (s *stubCore) ListConnections(ctx context.Context, subject, actorType, actorID string) ([]coreclient.ConnectionResponse, error) {
	s.subject = subject
	return []coreclient.ConnectionResponse{{ID: "conn_test_1", ActorType: actorType, ActorID: actorID, Provider: "salla", Name: "Salla Sync", Status: "active"}}, s.err
}

func (s *stubCore) UpsertEntityMapping(ctx context.Context, subject string, req coreclient.UpsertEntityMappingPayload) (*coreclient.EntityMappingResponse, error) {
	s.subject = subject
	return &coreclient.EntityMappingResponse{ID: "map_test_1", ConnectionID: req.ConnectionID, EntityType: req.EntityType, InternalID: req.InternalID, ExternalID: req.ExternalID, MappingStatus: "synced"}, s.err
}

func (s *stubCore) ListEntityMappings(ctx context.Context, subject, connectionID, entityType string) ([]coreclient.EntityMappingResponse, error) {
	s.subject = subject
	return []coreclient.EntityMappingResponse{{ID: "map_test_1", ConnectionID: connectionID, EntityType: entityType, InternalID: "int_1", ExternalID: "ext_1", MappingStatus: "synced"}}, s.err
}

func (s *stubCore) CreateSellerSyncJob(ctx context.Context, subject, connectionID, storeID, syncType string) (*coreclient.SellerSyncJobResponse, error) {
	s.storeID, s.subject = storeID, subject
	return &coreclient.SellerSyncJobResponse{ID: "job_test_1", StoreID: storeID, ConnectionID: connectionID, SyncType: syncType, Status: "PENDING"}, s.err
}

func (s *stubCore) GetSellerSyncJob(ctx context.Context, subject, jobID string) (*coreclient.SellerSyncJobResponse, error) {
	s.subject = subject
	return &coreclient.SellerSyncJobResponse{ID: jobID, StoreID: "store-1", ConnectionID: "conn-1", SyncType: "full", Status: "COMPLETED"}, s.err
}

func (s *stubCore) ListSellerSyncJobs(ctx context.Context, subject, storeID string) ([]coreclient.SellerSyncJobResponse, error) {
	s.storeID, s.subject = storeID, subject
	return []coreclient.SellerSyncJobResponse{{ID: "job_test_1", StoreID: storeID, ConnectionID: "conn-1", SyncType: "full", Status: "PENDING"}}, s.err
}

func (s *stubCore) CreateAPIKey(ctx context.Context, subject string, req coreclient.CreateAPIKeyPayload) (*coreclient.CreateAPIKeyResponse, error) {
	s.subject = subject
	return &coreclient.CreateAPIKeyResponse{
		Record:    coreclient.APIKeyResponse{ID: "key_1", ActorType: req.ActorType, ActorID: req.ActorID, Name: req.Name, KeyPrefix: "prefix_val", Scopes: req.Scopes, Status: "active"},
		RawAPIKey: "raw_key_val",
	}, s.err
}

func (s *stubCore) AuthenticateAPIKey(ctx context.Context, rawKey string) (*coreclient.APIKeyResponse, error) {
	if rawKey == "invalid" {
		return nil, &coreclient.Error{Status: 401, Code: "invalid_api_key"}
	}
	return &coreclient.APIKeyResponse{ID: "key_1", ActorType: "seller", ActorID: "store-1", Name: "Test Key", KeyPrefix: "prefix_val", Scopes: []string{"products:read"}, Status: "active"}, s.err
}

func (s *stubCore) ListAPIKeys(ctx context.Context, subject, actorType, actorID string) ([]coreclient.APIKeyResponse, error) {
	s.subject = subject
	return []coreclient.APIKeyResponse{{ID: "key_1", ActorType: actorType, ActorID: actorID, Name: "Test Key", KeyPrefix: "prefix_val", Status: "active"}}, s.err
}

func (s *stubCore) RevokeAPIKey(ctx context.Context, subject, keyID, actorID string) error {
	s.subject = subject
	return s.err
}

func (s *stubCore) CreateWebhookSubscription(ctx context.Context, subject string, req coreclient.CreateWebhookSubscriptionPayload) (*coreclient.WebhookSubscriptionResponse, error) {
	s.subject = subject
	return &coreclient.WebhookSubscriptionResponse{ID: "sub_1", ActorType: req.ActorType, ActorID: req.ActorID, TargetURL: req.TargetURL, SubscribedEvents: req.SubscribedEvents, Status: "active"}, s.err
}

func (s *stubCore) ListWebhookSubscriptions(ctx context.Context, subject, actorType, actorID string) ([]coreclient.WebhookSubscriptionResponse, error) {
	s.subject = subject
	return []coreclient.WebhookSubscriptionResponse{{ID: "sub_1", ActorType: actorType, ActorID: actorID, TargetURL: "https://example.com/webhook", SubscribedEvents: []string{"order.created"}, Status: "active"}}, s.err
}

func (s *stubCore) DeleteWebhookSubscription(ctx context.Context, subject, subID, actorID string) error {
	s.subject = subject
	return s.err
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

// Core rejects business-illegal order transitions with 422 and the
// invalid_order_transition code. The Seller API must surface that outcome
// unchanged — never as a 500 internal_error — and pass Core's reason through.
func TestSellerMapsInvalidOrderTransition(t *testing.T) {
	core := &stubCore{err: &coreclient.Error{
		Status:  http.StatusUnprocessableEntity,
		Code:    coreclient.CodeInvalidOrderTransition,
		Message: "cannot transition order from pending to shipped",
	}}
	handler := newHandler(core, core)

	rec := doRequest(t, handler, http.MethodPost, "/v1/seller/stores/store-1/orders/ord-1/transition", `{"target_status":"shipped"}`)
	body := rec.Body.String()

	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422 (body %q)", rec.Code, body)
	}
	if got := decodeError(t, rec); got != "invalid_order_transition" {
		t.Errorf("error code = %q, want invalid_order_transition", got)
	}
	if !strings.Contains(body, "cannot transition order from pending to shipped") {
		t.Errorf("Core message must be passed through, got: %s", body)
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

func TestStoreScopedCatalogAndRoleAuthorization(t *testing.T) {
	t.Run("store status transition role check", func(t *testing.T) {
		core := &stubCore{store: coreclient.Store{ID: "store-1", Status: "active"}}
		handlerOwner := newHandlerWithRole(core, core, auth.RoleSellerOwner)
		handlerStaff := newHandlerWithRole(core, core, auth.RoleSellerStaff)

		recStaff := doRequest(t, handlerStaff, http.MethodPost, "/v1/seller/stores/store-1/status", `{"status":"active"}`)
		if recStaff.Code != http.StatusForbidden {
			t.Errorf("staff status change status = %d, want 403", recStaff.Code)
		}

		recOwner := doRequest(t, handlerOwner, http.MethodPost, "/v1/seller/stores/store-1/status", `{"status":"active"}`)
		if recOwner.Code != http.StatusOK {
			t.Errorf("owner status change status = %d, want 200", recOwner.Code)
		}
	})

	t.Run("supplier offer browsing and import", func(t *testing.T) {
		core := &stubCore{
			catalog: []coreclient.SupplierCatalogItem{{OfferID: "offer-1"}},
			listing: coreclient.SellerListing{ID: "lst-1"},
		}
		handler := newHandler(core, core)

		recBrowse := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/store-1/supplier-offers", "")
		if recBrowse.Code != http.StatusOK {
			t.Errorf("browse status = %d, want 200", recBrowse.Code)
		}

		recImport := doRequest(t, handler, http.MethodPost, "/v1/seller/stores/store-1/supplier-offers/offer-1/imports", "")
		if recImport.Code != http.StatusCreated {
			t.Errorf("import status = %d, want 201", recImport.Code)
		}
	})

	t.Run("store listing publish unpublish and readiness", func(t *testing.T) {
		core := &stubCore{listing: coreclient.SellerListing{ID: "lst-100", Status: "published"}}
		handler := newHandler(core, core)

		recReadiness := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/store-1/listings/lst-100/readiness", "")
		if recReadiness.Code != http.StatusOK {
			t.Errorf("readiness status = %d, want 200", recReadiness.Code)
		}

		recPub := doRequest(t, handler, http.MethodPost, "/v1/seller/stores/store-1/listings/lst-100/publish", "")
		if recPub.Code != http.StatusOK {
			t.Errorf("publish status = %d, want 200", recPub.Code)
		}

		recUnpub := doRequest(t, handler, http.MethodPost, "/v1/seller/stores/store-1/listings/lst-100/unpublish", "")
		if recUnpub.Code != http.StatusOK {
			t.Errorf("unpublish status = %d, want 200", recUnpub.Code)
		}
	})

	t.Run("store media asset library presign and complete", func(t *testing.T) {
		core := &stubCore{}
		handler := newHandler(core, core)

		presignBody := `{"client_upload_id":"u-1","filename":"test.jpg","content_type":"image/jpeg","size_bytes":100,"checksum_sha256":"1234567890123456789012345678901234567890123456789012345678901234"}`
		recPresign := doRequest(t, handler, http.MethodPost, "/v1/seller/stores/store-1/media/uploads", presignBody)
		if recPresign.Code != http.StatusCreated {
			t.Errorf("presign status = %d, want 201 (body %q)", recPresign.Code, recPresign.Body.String())
		}

		compBody := `{"upload_token":"token-1"}`
		recComplete := doRequest(t, handler, http.MethodPost, "/v1/seller/stores/store-1/media/uploads/intent-1/complete", compBody)
		if recComplete.Code != http.StatusCreated {
			t.Errorf("complete status = %d, want 201 (body %q)", recComplete.Code, recComplete.Body.String())
		}
	})
}

func newHandlerWithRole(core CoreCapabilities, themes ThemeCapabilities, role string) http.Handler {
	router := chi.NewRouter()
	router.Use(i18n.Middleware(i18n.Default()))
	router.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			next.ServeHTTP(w, r.WithContext(auth.WithPrincipal(r.Context(), auth.Principal{
				Subject: testSubject,
				Roles:   []string{role},
			})))
		})
	})
	router.Route("/v1", func(r chi.Router) {
		RegisterSellerRoutes(Dependencies{Core: core})(r)
		RegisterSellerThemeRoutes(ThemeDependencies{Themes: themes})(r)
	})
	return router
}

func TestStoreShippingOperations(t *testing.T) {
	core := &stubCore{}
	handler := newHandler(core, core)

	t.Run("create shipment for order", func(t *testing.T) {
		body := `{"fulfillment_location_id":"loc-1","tracking_number":"TRACK123","shipping_cost_minor":1500,"cod_amount_minor":0,"currency":"SAR","items":[{"order_item_id":"item-1","quantity":2}]}`
		rec := doRequest(t, handler, http.MethodPost, "/v1/seller/stores/store-1/orders/ord-1/shipments", body)
		if rec.Code != http.StatusCreated {
			t.Fatalf("create shipment status = %d, want 201 (body %q)", rec.Code, rec.Body.String())
		}
	})

	t.Run("list shipments for order", func(t *testing.T) {
		rec := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/store-1/orders/ord-1/shipments", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("list order shipments status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
		}
	})

	t.Run("get shipment detail", func(t *testing.T) {
		rec := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/store-1/shipments/shp-1", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("get shipment status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
		}
	})

	t.Run("update shipment status", func(t *testing.T) {
		body := `{"status":"SHIPPED","tracking_number":"TRACK123","notes":"Handed to courier"}`
		rec := doRequest(t, handler, http.MethodPatch, "/v1/seller/stores/store-1/shipments/shp-1/status", body)
		if rec.Code != http.StatusOK {
			t.Fatalf("update shipment status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
		}
	})
}

func TestStorePaymentOperations(t *testing.T) {
	core := &stubCore{}
	handler := newHandler(core, core)

	t.Run("initialize payment for order", func(t *testing.T) {
		body := `{"amount_minor":25000,"currency":"SAR","payment_method":"COD"}`
		rec := doRequest(t, handler, http.MethodPost, "/v1/seller/stores/store-1/orders/ord-1/payments", body)
		if rec.Code != http.StatusCreated {
			t.Fatalf("initialize payment status = %d, want 201 (body %q)", rec.Code, rec.Body.String())
		}
	})

	t.Run("get order payment", func(t *testing.T) {
		rec := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/store-1/orders/ord-1/payments", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("get order payment status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
		}
	})

	t.Run("get payment detail", func(t *testing.T) {
		rec := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/store-1/payments/pay-1", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("get payment status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
		}
	})

	t.Run("update payment status", func(t *testing.T) {
		body := `{"status":"CAPTURED","provider":"manual","provider_reference":"COD-COLLECTED"}`
		rec := doRequest(t, handler, http.MethodPost, "/v1/seller/stores/store-1/payments/pay-1/status", body)
		if rec.Code != http.StatusOK {
			t.Fatalf("update payment status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
		}
	})
}

func TestStoreFinancialOperations(t *testing.T) {
	core := &stubCore{}
	handler := newHandler(core, core)

	t.Run("get store balance", func(t *testing.T) {
		rec := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/store-1/finance/balance", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("get store balance status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
		}
	})

	t.Run("list store ledger entries", func(t *testing.T) {
		rec := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/store-1/finance/ledger", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("list store ledger entries status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
		}
	})

	t.Run("list store settlements", func(t *testing.T) {
		rec := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/store-1/finance/settlements", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("list store settlements status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
		}
	})

	t.Run("list store payouts", func(t *testing.T) {
		rec := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/store-1/finance/payouts", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("list store payouts status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
		}
	})
}

func TestStoreIntegrationOperations(t *testing.T) {
	core := &stubCore{}
	handler := newHandler(core, core)

	t.Run("list store connections", func(t *testing.T) {
		rec := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/store-1/integrations/connections", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("list store connections status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
		}
	})

	t.Run("create store connection", func(t *testing.T) {
		body := `{"provider":"salla","name":"Salla Store Sync"}`
		rec := doRequest(t, handler, http.MethodPost, "/v1/seller/stores/store-1/integrations/connections", body)
		if rec.Code != http.StatusCreated {
			t.Fatalf("create store connection status = %d, want 201 (body %q)", rec.Code, rec.Body.String())
		}
	})

	t.Run("list store entity mappings", func(t *testing.T) {
		rec := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/store-1/integrations/mappings?connection_id=conn-1&entity_type=product", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("list store entity mappings status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
		}
	})

	t.Run("list store sync jobs", func(t *testing.T) {
		rec := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/store-1/integrations/sync-jobs", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("list store sync jobs status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
		}
	})

	t.Run("create store sync job", func(t *testing.T) {
		body := `{"connection_id":"conn-1","sync_type":"full"}`
		rec := doRequest(t, handler, http.MethodPost, "/v1/seller/stores/store-1/integrations/sync-jobs", body)
		if rec.Code != http.StatusCreated {
			t.Fatalf("create store sync job status = %d, want 201 (body %q)", rec.Code, rec.Body.String())
		}
	})

	t.Run("get store sync job", func(t *testing.T) {
		rec := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/store-1/integrations/sync-jobs/job-1", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("get store sync job status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
		}
	})
}

func TestPublicIntegrationAPI(t *testing.T) {
	core := &stubCore{}
	handler := newHandler(core, core)

	t.Run("API key management endpoints", func(t *testing.T) {
		recCreate := doRequest(t, handler, http.MethodPost, "/v1/seller/stores/store-1/integrations/api-keys", `{"name":"Public Integration Token","scopes":["products:read"],"live":false}`)
		if recCreate.Code != http.StatusCreated {
			t.Fatalf("create api key status = %d, want 201 (body %q)", recCreate.Code, recCreate.Body.String())
		}

		recList := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/store-1/integrations/api-keys", "")
		if recList.Code != http.StatusOK {
			t.Fatalf("list api keys status = %d, want 200 (body %q)", recList.Code, recList.Body.String())
		}

		recRevoke := doRequest(t, handler, http.MethodDelete, "/v1/seller/stores/store-1/integrations/api-keys/key_1", "")
		if recRevoke.Code != http.StatusOK {
			t.Fatalf("revoke api key status = %d, want 200 (body %q)", recRevoke.Code, recRevoke.Body.String())
		}
	})

	t.Run("webhook subscription endpoints", func(t *testing.T) {
		recCreate := doRequest(t, handler, http.MethodPost, "/v1/seller/stores/store-1/integrations/webhooks", `{"target_url":"https://example.com/wh","subscribed_events":["order.created"]}`)
		if recCreate.Code != http.StatusCreated {
			t.Fatalf("create webhook sub status = %d, want 201 (body %q)", recCreate.Code, recCreate.Body.String())
		}

		recList := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/store-1/integrations/webhooks", "")
		if recList.Code != http.StatusOK {
			t.Fatalf("list webhook subs status = %d, want 200 (body %q)", recList.Code, recList.Body.String())
		}

		recDel := doRequest(t, handler, http.MethodDelete, "/v1/seller/stores/store-1/integrations/webhooks/sub_1", "")
		if recDel.Code != http.StatusOK {
			t.Fatalf("delete webhook sub status = %d, want 200 (body %q)", recDel.Code, recDel.Body.String())
		}
	})

	t.Run("public gateway authentication requirement", func(t *testing.T) {
		recUnauth := doRequest(t, handler, http.MethodGet, "/v1/public/products", "")
		if recUnauth.Code != http.StatusUnauthorized {
			t.Fatalf("unauthenticated public endpoint status = %d, want 401", recUnauth.Code)
		}

		req := httptest.NewRequest(http.MethodGet, "/v1/public/products", nil)
		req.Header.Set("X-Matjero-API-Key", "raw_key_val")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("authenticated public endpoint status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
		}
		if rec.Header().Get("X-RateLimit-Limit") == "" {
			t.Errorf("missing rate limit header X-RateLimit-Limit")
		}
	})
}
