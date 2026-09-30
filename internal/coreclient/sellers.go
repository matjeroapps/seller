package coreclient

import (
	"context"
	"net/url"
	"strconv"
	"time"

	"seller/internal/money"
)

// Seller DTOs. These are Seller-owned wire shapes for Core-owned business data.

// Seller is a seller profile. The field set and JSON shape match the public
// contract the Seller API has always published; changing it is a public contract
// change, not a client detail.
type Seller struct {
	ID        string    `json:"id"`
	Code      string    `json:"code"`
	Name      string    `json:"name"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Store is a seller store.
type Store struct {
	ID         string    `json:"id"`
	SellerID   string    `json:"seller_id"`
	MarketCode string    `json:"market_code"`
	Code       string    `json:"code"`
	Name       string    `json:"name"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type StoreOperationalState struct {
	StoreID            string     `json:"store_id"`
	CheckoutStatus     string     `json:"checkout_status"`
	MaintenanceMessage string     `json:"maintenance_message"`
	UpdatedBy          string     `json:"updated_by,omitempty"`
	UpdatedAt          *time.Time `json:"updated_at,omitempty"`
	CheckoutAccepting  bool       `json:"checkout_accepting"`
}

type StoreOperationalStateUpdate struct {
	CheckoutStatus     string `json:"checkout_status"`
	MaintenanceMessage string `json:"maintenance_message,omitempty"`
}

// SellerListing is a seller's listing of a supplier offer.
type SellerListing struct {
	ID              string    `json:"id"`
	StoreID         string    `json:"store_id"`
	ProductID       string    `json:"product_id"`
	SupplierOfferID *string   `json:"supplier_offer_id,omitempty"`
	MarketCode      string    `json:"market_code"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// SupplierCatalogItem is a supplier offer available to a store's market.
type SupplierCatalogItem struct {
	OfferID          string       `json:"offer_id"`
	OfferStatus      string       `json:"offer_status"`
	MarketCode       string       `json:"market_code"`
	ProductID        string       `json:"product_id"`
	ProductSlug      string       `json:"product_slug"`
	ProductName      string       `json:"product_name"`
	ProductStatus    string       `json:"product_status"`
	SupplierID       string       `json:"supplier_id"`
	SupplierCode     string       `json:"supplier_code"`
	SupplierName     string       `json:"supplier_name"`
	CategoryID       string       `json:"category_id,omitempty"`
	CategoryName     string       `json:"category_name,omitempty"`
	Price            *money.Money `json:"price,omitempty"`
	MinimumOrderQty  int64        `json:"minimum_order_quantity,omitempty"`
	SKUID            string       `json:"sku_id,omitempty"`
	SKUCode          string       `json:"sku_code,omitempty"`
	PrimaryMediaID   string       `json:"primary_media_id,omitempty"`
	PrimaryMediaURI  string       `json:"primary_media_uri,omitempty"`
	IsAvailable      *bool        `json:"is_available,omitempty"`
	AvailableQty     *int64       `json:"available_qty,omitempty"`
	FulfillmentCount int64        `json:"fulfillment_count,omitempty"`
	UpdatedAt        time.Time    `json:"updated_at"`
}

// Page is a pagination window.
type Page struct {
	Limit  int
	Offset int
}

func (p Page) values() url.Values {
	values := url.Values{}
	if p.Limit > 0 {
		values.Set("limit", strconv.Itoa(p.Limit))
	}
	if p.Offset > 0 {
		values.Set("offset", strconv.Itoa(p.Offset))
	}
	return values
}

// --- Response envelopes ---

type sellerResolveResponse struct {
	SellerID string `json:"seller_id"`
}

type sellerProfileResponse struct {
	Seller   Seller         `json:"seller"`
	Settings map[string]any `json:"settings"`
}

// SellerStoreListResponse contains seller stores and entitlement summary.
type SellerStoreListResponse struct {
	Items            []Store `json:"items"`
	ActiveStoreLimit int     `json:"active_store_limit"`
	ActiveStoreCount int     `json:"active_store_count"`
}

type collectionResponse[T any] struct {
	Items []T `json:"items"`
}

type statusResponse struct {
	Status string `json:"status"`
}

// StructuredReadinessReason describes a single publish readiness issue.
type StructuredReadinessReason struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// StructuredPublishReadiness is Core's machine-readable readiness evaluation.
type StructuredPublishReadiness struct {
	IsReady bool                        `json:"is_ready"`
	Reasons []StructuredReadinessReason `json:"reasons"`
}

// --- Seller capabilities ---

// ResolveSeller maps an authenticated subject to its seller identity. Core
// performs the resolution; Seller never asserts a seller identifier.
func (c *Client) ResolveSeller(ctx context.Context, subject string) (string, error) {
	var payload sellerResolveResponse
	err := c.get(ctx, "/internal/v1/sellers/resolve", nil, requestOptions{Subject: subject}, &payload)
	return payload.SellerID, err
}

// GetSeller returns a seller profile and settings.
func (c *Client) GetSeller(ctx context.Context, sellerID, subject string) (Seller, map[string]any, error) {
	var payload sellerProfileResponse
	path := "/internal/v1/sellers/" + url.PathEscape(sellerID)
	err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &payload)
	return payload.Seller, payload.Settings, err
}

// ProfileUpdate is the seller profile mutation payload.
type ProfileUpdate struct {
	Name     string         `json:"name"`
	Status   string         `json:"status"`
	Settings map[string]any `json:"settings"`
}

// UpdateSellerProfile updates a seller profile.
func (c *Client) UpdateSellerProfile(ctx context.Context, sellerID, subject string, update ProfileUpdate) (string, error) {
	var payload statusResponse
	path := "/internal/v1/sellers/" + url.PathEscape(sellerID) + "/profile"
	err := c.put(ctx, path, update, requestOptions{Subject: subject}, &payload)
	return payload.Status, err
}

// ListSellerStores lists the stores owned by a seller along with active store entitlement bounds.
func (c *Client) ListSellerStores(ctx context.Context, sellerID, subject string, page Page) (*SellerStoreListResponse, error) {
	var payload SellerStoreListResponse
	path := "/internal/v1/sellers/" + url.PathEscape(sellerID) + "/stores"
	err := c.get(ctx, path, page.values(), requestOptions{Subject: subject}, &payload)
	if err != nil {
		return nil, err
	}
	return &payload, nil
}

// StoreCreate is the store creation payload.
type StoreCreate struct {
	MarketCode string         `json:"market_code"`
	Code       string         `json:"code"`
	Name       string         `json:"name"`
	Status     string         `json:"status"`
	Settings   map[string]any `json:"settings"`
}

// CreateSellerStore creates a store for the authenticated seller.
func (c *Client) CreateSellerStore(ctx context.Context, sellerID, subject string, create StoreCreate) (Store, error) {
	var payload Store
	path := "/internal/v1/sellers/" + url.PathEscape(sellerID) + "/stores"
	err := c.post(ctx, path, create, requestOptions{Subject: subject}, &payload)
	return payload, err
}

// --- Store capabilities ---

// GetStore returns a store, enforcing that the caller owns it.
func (c *Client) GetStore(ctx context.Context, storeID, subject string) (Store, error) {
	var payload Store
	path := "/internal/v1/stores/" + url.PathEscape(storeID)
	err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &payload)
	return payload, err
}

// UpdateStoreStatus updates a store status through Core entitlement checks.
func (c *Client) UpdateStoreStatus(ctx context.Context, storeID, subject, status string) (*Store, error) {
	var payload Store
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/status"
	err := c.post(ctx, path, map[string]string{"status": status}, requestOptions{Subject: subject}, &payload)
	if err != nil {
		return nil, err
	}
	return &payload, nil
}

func (c *Client) GetStoreOperationalState(ctx context.Context, storeID, subject string) (*StoreOperationalState, error) {
	var payload StoreOperationalState
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/operational-state"
	err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &payload)
	if err != nil {
		return nil, err
	}
	return &payload, nil
}

func (c *Client) UpdateStoreOperationalState(ctx context.Context, storeID, subject string, update StoreOperationalStateUpdate) (*StoreOperationalState, error) {
	var payload StoreOperationalState
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/operational-state"
	err := c.put(ctx, path, update, requestOptions{Subject: subject}, &payload)
	if err != nil {
		return nil, err
	}
	return &payload, nil
}

// SupplierCatalogFilter narrows the supplier catalog browse.
type SupplierCatalogFilter struct {
	SupplierID string
	CategoryID string
	Query      string
	Page       Page
}

// ListSupplierCatalog browses supplier offers available to a store's market.
// The market scope is decided by Core from the store record.
func (c *Client) ListSupplierCatalog(ctx context.Context, storeID, subject string, filter SupplierCatalogFilter) ([]SupplierCatalogItem, error) {
	var payload collectionResponse[SupplierCatalogItem]
	query := filter.Page.values()
	if filter.SupplierID != "" {
		query.Set("supplier_id", filter.SupplierID)
	}
	if filter.CategoryID != "" {
		query.Set("category_id", filter.CategoryID)
	}
	if filter.Query != "" {
		query.Set("query", filter.Query)
	}
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/supplier-catalog"
	err := c.get(ctx, path, query, requestOptions{Subject: subject}, &payload)
	return payload.Items, err
}

// ListStoreSupplierOffers browses eligible supplier offers for a store.
func (c *Client) ListStoreSupplierOffers(ctx context.Context, storeID, subject string, filter SupplierCatalogFilter) ([]SupplierCatalogItem, error) {
	var payload collectionResponse[SupplierCatalogItem]
	query := filter.Page.values()
	if filter.SupplierID != "" {
		query.Set("supplier_id", filter.SupplierID)
	}
	if filter.CategoryID != "" {
		query.Set("category_id", filter.CategoryID)
	}
	if filter.Query != "" {
		query.Set("query", filter.Query)
	}
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/supplier-offers"
	err := c.get(ctx, path, query, requestOptions{Subject: subject}, &payload)
	return payload.Items, err
}

// ImportSupplierOffer idempotently creates a seller listing from a supplier offer.
func (c *Client) ImportSupplierOffer(ctx context.Context, storeID, offerID, subject string) (*SellerListing, error) {
	var payload SellerListing
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/supplier-offers/" + url.PathEscape(offerID) + "/imports"
	err := c.post(ctx, path, nil, requestOptions{Subject: subject}, &payload)
	if err != nil {
		return nil, err
	}
	return &payload, nil
}

// ListStoreListings lists a store's seller listings.
func (c *Client) ListStoreListings(ctx context.Context, storeID, subject string, page Page) ([]SellerListing, error) {
	var payload collectionResponse[SellerListing]
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/listings"
	err := c.get(ctx, path, page.values(), requestOptions{Subject: subject}, &payload)
	return payload.Items, err
}

// GetStoreListing fetches a specific store listing by ID.
func (c *Client) GetStoreListing(ctx context.Context, storeID, listingID, subject string) (*SellerListing, error) {
	var payload SellerListing
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/listings/" + url.PathEscape(listingID)
	err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &payload)
	if err != nil {
		return nil, err
	}
	return &payload, nil
}

// SellerListingLifecycle represents the lifecycle status and upstream availability of an imported listing.
type SellerListingLifecycle struct {
	ListingID              string       `json:"listing_id"`
	StoreID                string       `json:"store_id"`
	Status                 string       `json:"status"`
	EffectiveAvailability  string       `json:"effective_availability"`
	IsUpstreamAvailable    bool         `json:"is_upstream_available"`
	SupplierOfferID        *string      `json:"supplier_offer_id,omitempty"`
	SupplierOfferStatus    *string      `json:"supplier_offer_status,omitempty"`
	HasMarginWarning       bool         `json:"has_margin_warning"`
	CurrentRetailPrice     *money.Money `json:"current_retail_price,omitempty"`
	UpstreamWholesalePrice *money.Money `json:"upstream_wholesale_price,omitempty"`
	LastSyncedAt           time.Time    `json:"last_synced_at"`
}

// GetStoreListingLifecycle fetches the lifecycle synchronization status for a specific store listing.
func (c *Client) GetStoreListingLifecycle(ctx context.Context, storeID, listingID, subject string) (*SellerListingLifecycle, error) {
	var payload SellerListingLifecycle
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/listings/" + url.PathEscape(listingID) + "/lifecycle"
	err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &payload)
	if err != nil {
		return nil, err
	}
	return &payload, nil
}

// ListingImport is the listing import payload. The target store is the
// authorized path parameter, never the body.
type ListingImport struct {
	ProductID       string  `json:"product_id"`
	SupplierOfferID *string `json:"supplier_offer_id"`
	Status          string  `json:"status"`
	MarketCode      string  `json:"market_code"`
}

// ImportListing imports a supplier offer into a store.
func (c *Client) ImportListing(ctx context.Context, storeID, subject string, importReq ListingImport) (SellerListing, error) {
	var payload SellerListing
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/listings"
	err := c.post(ctx, path, importReq, requestOptions{Subject: subject}, &payload)
	return payload, err
}

// PriceUpdate sets a listing price in minor units.
type PriceUpdate struct {
	AmountMinor int64  `json:"amount_minor"`
	Currency    string `json:"currency"`
}

// SetListingPrice sets a seller listing price.
func (c *Client) SetListingPrice(ctx context.Context, listingID, subject string, price PriceUpdate) error {
	path := "/internal/v1/listings/" + url.PathEscape(listingID) + "/price"
	return c.post(ctx, path, price, requestOptions{Subject: subject}, &statusResponse{})
}

// SetStoreListingPrice sets a store listing retail price.
func (c *Client) SetStoreListingPrice(ctx context.Context, storeID, listingID, subject string, price PriceUpdate) error {
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/listings/" + url.PathEscape(listingID) + "/price"
	return c.put(ctx, path, price, requestOptions{Subject: subject}, nil)
}

// GetStoreListingReadiness returns machine-readable publish readiness for a store listing.
func (c *Client) GetStoreListingReadiness(ctx context.Context, storeID, listingID, subject string) (*StructuredPublishReadiness, error) {
	var payload StructuredPublishReadiness
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/listings/" + url.PathEscape(listingID) + "/readiness"
	err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &payload)
	if err != nil {
		return nil, err
	}
	return &payload, nil
}

// PublishStoreListing publishes a store listing.
func (c *Client) PublishStoreListing(ctx context.Context, storeID, listingID, subject string) (*SellerListing, error) {
	var payload SellerListing
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/listings/" + url.PathEscape(listingID) + "/publish"
	err := c.post(ctx, path, nil, requestOptions{Subject: subject}, &payload)
	if err != nil {
		return nil, err
	}
	return &payload, nil
}

// UnpublishStoreListing unpublishes a store listing.
func (c *Client) UnpublishStoreListing(ctx context.Context, storeID, listingID, subject string) (*SellerListing, error) {
	var payload SellerListing
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/listings/" + url.PathEscape(listingID) + "/unpublish"
	err := c.post(ctx, path, nil, requestOptions{Subject: subject}, &payload)
	if err != nil {
		return nil, err
	}
	return &payload, nil
}

// ArchiveStoreListing archives a store listing.
func (c *Client) ArchiveStoreListing(ctx context.Context, storeID, listingID, subject string) (*SellerListing, error) {
	var payload SellerListing
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/listings/" + url.PathEscape(listingID) + "/archive"
	err := c.post(ctx, path, nil, requestOptions{Subject: subject}, &payload)
	if err != nil {
		return nil, err
	}
	return &payload, nil
}

// StatusUpdate is a status mutation payload.
type StatusUpdate struct {
	Status string `json:"status"`
}

// UpdateListingStatus updates a seller listing status.
func (c *Client) UpdateListingStatus(ctx context.Context, listingID, subject, status string) error {
	path := "/internal/v1/listings/" + url.PathEscape(listingID) + "/status"
	return c.post(ctx, path, StatusUpdate{Status: status}, requestOptions{Subject: subject}, &statusResponse{})
}
