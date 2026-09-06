package coreclient

import (
	"context"
	"fmt"
	"net/url"
	"strconv"
	"time"
)

// DTOs for Seller Catalog & Order operations

type SellerProductTranslation struct {
	Locale      string `json:"locale"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type SellerProductDraft struct {
	Slug         string                     `json:"slug"`
	Translations []SellerProductTranslation `json:"translations"`
	CategoryIDs  []string                   `json:"category_ids,omitempty"`
}

type SellerProduct struct {
	ID        string    `json:"id"`
	Slug      string    `json:"slug"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Variant struct {
	ID        string    `json:"id"`
	ProductID string    `json:"product_id"`
	Code      string    `json:"code"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type SKU struct {
	ID        string    `json:"id"`
	VariantID string    `json:"variant_id"`
	Code      string    `json:"code"`
	Barcode   *string   `json:"barcode,omitempty"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type MediaMetadata struct {
	ID         string         `json:"id"`
	ProductID  string         `json:"product_id"`
	MediaType  string         `json:"media_type"`
	URI        string         `json:"uri"`
	StorageKey string         `json:"storage_key,omitempty"`
	AltText    string         `json:"alt_text"`
	SortOrder  int            `json:"sort_order"`
	IsPrimary  bool           `json:"is_primary"`
	Metadata   map[string]any `json:"metadata,omitempty"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
}

// MoneyDTO is Core's money object: a minor-unit amount plus an ISO currency code.
type MoneyDTO struct {
	Amount   int64  `json:"amount"`
	Currency string `json:"currency"`
}

// InventoryLocation is one per-location inventory row inside the aggregate
// inventory_summary of a product payload.
type InventoryLocation struct {
	LocationID   string `json:"location_id"`
	LocationName string `json:"location_name"`
	SKUID        string `json:"sku_id"`
	OnHandQty    int64  `json:"on_hand_qty"`
	ReservedQty  int64  `json:"reserved_qty"`
	AvailableQty int64  `json:"available_qty"`
}

// InventorySummary is the aggregate product-level inventory projection:
// store-wide totals plus one entry per fulfillment location.
type InventorySummary struct {
	TotalOnHand    int64               `json:"total_on_hand"`
	TotalReserved  int64               `json:"total_reserved"`
	TotalAvailable int64               `json:"total_available"`
	Locations      []InventoryLocation `json:"locations"`
}

type PublishReadiness struct {
	IsReady bool     `json:"is_ready"`
	Reasons []string `json:"reasons"`
}

type ProductPageSection struct {
	ID        string         `json:"id"`
	Type      string         `json:"type"`
	Enabled   bool           `json:"enabled"`
	SortOrder int            `json:"sort_order"`
	Content   map[string]any `json:"content"`
}

type SellerListingPresentation struct {
	SellerListingID  string               `json:"seller_listing_id"`
	SchemaVersion    int                  `json:"schema_version"`
	PurchaseBehavior string               `json:"purchase_behavior"`
	Sections         []ProductPageSection `json:"sections"`
	CreatedAt        time.Time            `json:"created_at"`
	UpdatedAt        time.Time            `json:"updated_at"`
}

type SellerProductDetail struct {
	Product          SellerProduct              `json:"product"`
	Source           string                     `json:"source"`
	Translations     []SellerProductTranslation `json:"translations"`
	CategoryIDs      []string                   `json:"category_ids"`
	Variants         []Variant                  `json:"variants"`
	SKUs             []SKU                      `json:"skus"`
	Media            []MediaMetadata            `json:"media"`
	Listing          SellerListing              `json:"listing"`
	CurrentPrice     *MoneyDTO                  `json:"current_price"`
	InventorySummary InventorySummary           `json:"inventory_summary"`
	Presentation     SellerListingPresentation  `json:"presentation"`
	PurchaseBehavior string                     `json:"purchase_behavior"`
	PublishReadiness PublishReadiness           `json:"publish_readiness"`
}

type SellerProductListItem struct {
	Product          SellerProduct    `json:"product"`
	Source           string           `json:"source"`
	Name             string           `json:"name"`
	ListingStatus    string           `json:"listing_status"`
	ListingID        string           `json:"listing_id"`
	CurrentPrice     *MoneyDTO        `json:"current_price"`
	InventorySummary InventorySummary `json:"inventory_summary"`
	PublishReadiness PublishReadiness `json:"publish_readiness"`
}

type SellerProductListResponse struct {
	Products []SellerProductListItem `json:"products"`
	Total    int                     `json:"total"`
	Limit    int                     `json:"limit"`
	Offset   int                     `json:"offset"`
}

type MediaUploadRequest struct {
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	SizeBytes   int64  `json:"size_bytes"`
}

type MediaUploadResponse struct {
	UploadURL   string    `json:"upload_url"`
	StorageKey  string    `json:"storage_key"`
	UploadToken string    `json:"upload_token"`
	ExpiresAt   time.Time `json:"expires_at"`
}

type CompleteMediaUploadRequest struct {
	StorageKey  string `json:"storage_key"`
	UploadToken string `json:"upload_token"`
	AltText     string `json:"alt_text"`
	SortOrder   int    `json:"sort_order"`
	IsPrimary   bool   `json:"is_primary"`
}

// StoreLocation mirrors Core's fulfillment location record. Store-owned
// locations carry an empty supplier_id and supplier_market_id.
type StoreLocation struct {
	SupplierID       string    `json:"supplier_id"`
	StoreID          string    `json:"store_id,omitempty"`
	ID               string    `json:"id"`
	SupplierMarketID string    `json:"supplier_market_id"`
	MarketCode       string    `json:"market_code"`
	Code             string    `json:"code"`
	Name             string    `json:"name"`
	LocationType     string    `json:"location_type"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// StoreLocationListResponse is the list envelope Core returns for store
// locations.
type StoreLocationListResponse struct {
	Locations []StoreLocation `json:"locations"`
}

// InventorySnapshot is Core's raw inventory snapshot record, returned by the
// snapshot create and adjustment mutations.
type InventorySnapshot struct {
	ID                    string    `json:"id"`
	FulfillmentLocationID string    `json:"fulfillment_location_id"`
	SKUID                 string    `json:"sku_id"`
	OnHandQty             int64     `json:"on_hand_qty"`
	ReservedQty           int64     `json:"reserved_qty"`
	Version               int64     `json:"version"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

// SellerInventorySummary is the enriched inventory row returned by the store
// inventory list: the snapshot identity plus the resolved location name and
// derived available quantity.
type SellerInventorySummary struct {
	ID                    string `json:"id"`
	FulfillmentLocationID string `json:"fulfillment_location_id"`
	LocationName          string `json:"location_name"`
	SKUID                 string `json:"sku_id"`
	OnHandQty             int64  `json:"on_hand_qty"`
	ReservedQty           int64  `json:"reserved_qty"`
	AvailableQty          int64  `json:"available_qty"`
	Version               int64  `json:"version"`
}

// SellerInventoryListResponse is the list envelope Core returns for store
// inventory.
type SellerInventoryListResponse struct {
	Inventory []SellerInventorySummary `json:"inventory"`
}

type CreateSnapshotRequest struct {
	LocationID string `json:"location_id"`
	SKUID      string `json:"sku_id"`
	OnHandQty  int64  `json:"on_hand_qty"`
}

type AdjustInventoryRequest struct {
	DeltaQuantity int64   `json:"quantity_delta"`
	Reason        *string `json:"reason,omitempty"`
}

type SellerOrderItem struct {
	ID          string `json:"id"`
	ProductName string `json:"product_name"`
	SKUCode     string `json:"sku_code"`
	Quantity    int    `json:"quantity"`
	UnitPrice   int64  `json:"unit_price"`
	TotalPrice  int64  `json:"total_price"`
	Source      string `json:"source"`
}

type SellerOrderTimelineEvent struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	Detail    string    `json:"detail"`
	CreatedAt time.Time `json:"created_at"`
}

// SellerOrderTimelineEntry aliases SellerOrderTimelineEvent for Core DTO alignment.
type SellerOrderTimelineEntry = SellerOrderTimelineEvent

type SellerOrder struct {
	ID                     string     `json:"id"`
	OrderNumber            string     `json:"order_number"`
	Status                 string     `json:"status"`
	Currency               string     `json:"currency"`
	Total                  int64      `json:"total"`
	ItemCount              int        `json:"item_count"`
	RecipientName          string     `json:"recipient_name"`
	ConfirmationDeadlineAt *time.Time `json:"confirmation_deadline_at,omitempty"`
	CreatedAt              time.Time  `json:"created_at"`
}

type SellerOrderDetail struct {
	ID                     string                     `json:"id"`
	OrderNumber            string                     `json:"order_number"`
	Status                 string                     `json:"status"`
	Currency               string                     `json:"currency"`
	Subtotal               int64                      `json:"subtotal"`
	Total                  int64                      `json:"total"`
	ItemCount              int                        `json:"item_count"`
	ConfirmationDeadlineAt *time.Time                 `json:"confirmation_deadline_at,omitempty"`
	ShippingAddress        map[string]any             `json:"shipping_address"`
	ContactEmail           string                     `json:"contact_email"`
	Items                  []SellerOrderItem          `json:"items"`
	Timeline               []SellerOrderTimelineEvent `json:"timeline"`
	AllowedNextActions     []string                   `json:"allowed_next_actions"`
	CreatedAt              time.Time                  `json:"created_at"`
	UpdatedAt              time.Time                  `json:"updated_at"`
}

type SellerOrderListResponse struct {
	Orders []SellerOrder `json:"orders"`
	Total  int           `json:"total"`
	Limit  int           `json:"limit"`
	Offset int           `json:"offset"`
}

type OrderTransitionRequest struct {
	TargetStatus string  `json:"target_status"`
	Reason       *string `json:"reason,omitempty"`
}

// Client methods using client's internal get/post/put/delete helpers

func (c *Client) ListStoreProducts(ctx context.Context, subject, storeID, status, source, query string, limit, offset int) (*SellerProductListResponse, error) {
	values := make(url.Values)
	if status != "" {
		values.Set("status", status)
	}
	if source != "" {
		values.Set("source", source)
	}
	if query != "" {
		values.Set("query", query)
	}
	if limit > 0 {
		values.Set("limit", strconv.Itoa(limit))
	}
	if offset > 0 {
		values.Set("offset", strconv.Itoa(offset))
	}

	path := fmt.Sprintf("/internal/v1/stores/%s/products", url.PathEscape(storeID))
	var res SellerProductListResponse
	if err := c.get(ctx, path, values, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) CreateSellerProduct(ctx context.Context, subject, storeID string, draft SellerProductDraft) (*SellerProductDetail, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/products", url.PathEscape(storeID))
	var res SellerProductDetail
	if err := c.post(ctx, path, draft, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) GetSellerProductDetail(ctx context.Context, subject, storeID, productID string) (*SellerProductDetail, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/products/%s", url.PathEscape(storeID), url.PathEscape(productID))
	var res SellerProductDetail
	if err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) UpdateSellerProduct(ctx context.Context, subject, storeID, productID string, slug string, translations []SellerProductTranslation, categoryIDs []string) (*SellerProductDetail, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/products/%s", url.PathEscape(storeID), url.PathEscape(productID))
	body := map[string]any{
		"slug":         slug,
		"translations": translations,
		"category_ids": categoryIDs,
	}
	var res SellerProductDetail
	if err := c.put(ctx, path, body, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) CreateVariant(ctx context.Context, subject, storeID, productID, code, status string) (*Variant, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/products/%s/variants", url.PathEscape(storeID), url.PathEscape(productID))
	body := map[string]any{"code": code, "status": status}
	var res Variant
	if err := c.post(ctx, path, body, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) UpdateVariant(ctx context.Context, subject, storeID, productID, variantID, code, status string) (*Variant, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/products/%s/variants/%s", url.PathEscape(storeID), url.PathEscape(productID), url.PathEscape(variantID))
	body := map[string]any{"code": code, "status": status}
	var res Variant
	if err := c.put(ctx, path, body, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) CreateSKU(ctx context.Context, subject, storeID, productID, variantID, code string, barcode *string, status string) (*SKU, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/products/%s/variants/%s/skus", url.PathEscape(storeID), url.PathEscape(productID), url.PathEscape(variantID))
	body := map[string]any{"code": code, "barcode": barcode, "status": status}
	var res SKU
	if err := c.post(ctx, path, body, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) UpdateSKU(ctx context.Context, subject, storeID, productID, variantID, skuID, code string, barcode *string, status string) (*SKU, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/products/%s/variants/%s/skus/%s", url.PathEscape(storeID), url.PathEscape(productID), url.PathEscape(variantID), url.PathEscape(skuID))
	body := map[string]any{"code": code, "barcode": barcode, "status": status}
	var res SKU
	if err := c.put(ctx, path, body, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) CreateMediaUpload(ctx context.Context, subject, storeID, productID string, uploadReq MediaUploadRequest) (*MediaUploadResponse, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/products/%s/media/uploads", url.PathEscape(storeID), url.PathEscape(productID))
	var res MediaUploadResponse
	if err := c.post(ctx, path, uploadReq, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) CompleteMediaUpload(ctx context.Context, subject, storeID, productID string, compReq CompleteMediaUploadRequest) (*MediaMetadata, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/products/%s/media", url.PathEscape(storeID), url.PathEscape(productID))
	var res MediaMetadata
	if err := c.post(ctx, path, compReq, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) UpdateMedia(ctx context.Context, subject, storeID, productID, mediaID, altText string, sortOrder int, isPrimary bool) (*MediaMetadata, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/products/%s/media/%s", url.PathEscape(storeID), url.PathEscape(productID), url.PathEscape(mediaID))
	body := map[string]any{"alt_text": altText, "sort_order": sortOrder, "is_primary": isPrimary}
	var res MediaMetadata
	if err := c.put(ctx, path, body, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) DeleteMedia(ctx context.Context, subject, storeID, productID, mediaID string) error {
	path := fmt.Sprintf("/internal/v1/stores/%s/products/%s/media/%s", url.PathEscape(storeID), url.PathEscape(productID), url.PathEscape(mediaID))
	return c.delete(ctx, path, requestOptions{Subject: subject}, nil)
}

func (c *Client) ListStoreLocations(ctx context.Context, subject, storeID string) ([]StoreLocation, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/locations", url.PathEscape(storeID))
	var res StoreLocationListResponse
	if err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return res.Locations, nil
}

func (c *Client) CreateStoreLocation(ctx context.Context, subject, storeID, code, name, locType, status string) (*StoreLocation, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/locations", url.PathEscape(storeID))
	body := map[string]any{"code": code, "name": name, "location_type": locType, "status": status}
	var res StoreLocation
	if err := c.post(ctx, path, body, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) ListStoreInventory(ctx context.Context, subject, storeID string) ([]SellerInventorySummary, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/inventory", url.PathEscape(storeID))
	var res SellerInventoryListResponse
	if err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return res.Inventory, nil
}

func (c *Client) CreateInventorySnapshot(ctx context.Context, subject, storeID string, reqDTO CreateSnapshotRequest) (*InventorySnapshot, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/inventory/snapshots", url.PathEscape(storeID))
	var res InventorySnapshot
	if err := c.post(ctx, path, reqDTO, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) AdjustInventory(ctx context.Context, subject, storeID, snapshotID string, reqDTO AdjustInventoryRequest) (*InventorySnapshot, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/inventory/%s/adjustments", url.PathEscape(storeID), url.PathEscape(snapshotID))
	var res InventorySnapshot
	if err := c.post(ctx, path, reqDTO, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) GetListingPresentation(ctx context.Context, subject, storeID, listingID string) (*SellerListingPresentation, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/listings/%s/presentation", url.PathEscape(storeID), url.PathEscape(listingID))
	var res SellerListingPresentation
	if err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) UpdateListingPresentation(ctx context.Context, subject, storeID, listingID string, pres SellerListingPresentation) (*SellerListingPresentation, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/listings/%s/presentation", url.PathEscape(storeID), url.PathEscape(listingID))
	var res SellerListingPresentation
	if err := c.put(ctx, path, pres, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) PublishSellerProduct(ctx context.Context, subject, storeID, productID string) error {
	path := fmt.Sprintf("/internal/v1/stores/%s/products/%s/publish", url.PathEscape(storeID), url.PathEscape(productID))
	return c.post(ctx, path, nil, requestOptions{Subject: subject}, nil)
}

func (c *Client) UnpublishSellerProduct(ctx context.Context, subject, storeID, productID string) error {
	path := fmt.Sprintf("/internal/v1/stores/%s/products/%s/unpublish", url.PathEscape(storeID), url.PathEscape(productID))
	return c.post(ctx, path, nil, requestOptions{Subject: subject}, nil)
}

func (c *Client) ListStoreOrders(ctx context.Context, subject, storeID, status string, limit, offset int) (*SellerOrderListResponse, error) {
	values := make(url.Values)
	if status != "" {
		values.Set("status", status)
	}
	if limit > 0 {
		values.Set("limit", strconv.Itoa(limit))
	}
	if offset > 0 {
		values.Set("offset", strconv.Itoa(offset))
	}

	path := fmt.Sprintf("/internal/v1/stores/%s/orders", url.PathEscape(storeID))
	var res SellerOrderListResponse
	if err := c.get(ctx, path, values, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) GetStoreOrderDetail(ctx context.Context, subject, storeID, orderID string) (*SellerOrderDetail, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/orders/%s", url.PathEscape(storeID), url.PathEscape(orderID))
	var res SellerOrderDetail
	if err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) TransitionStoreOrder(ctx context.Context, subject, storeID, orderID string, reqDTO OrderTransitionRequest) (*SellerOrderDetail, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/orders/%s/transition", url.PathEscape(storeID), url.PathEscape(orderID))
	var res SellerOrderDetail
	if err := c.post(ctx, path, reqDTO, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

// SellerCategory is a global commerce category as exposed by Core's category
// list endpoint. Only id, slug and status are carried; translations are not
// needed for category assignment pickers.
type SellerCategory struct {
	ID     string `json:"id"`
	Slug   string `json:"slug"`
	Status string `json:"status"`
}

// SellerCategoryListResponse is Core's standard collection envelope for the
// category list endpoint.
type SellerCategoryListResponse struct {
	Items []SellerCategory `json:"items"`
}

// ListCategories lists the platform categories Core exposes at
// GET /internal/v1/categories. Note: Core currently gates that route to admin
// callers (requireCallers(CallerAdmin)); the Seller service credential must be
// allowed there for this call to succeed at runtime.
func (c *Client) ListCategories(ctx context.Context, subject string, limit, offset int) ([]SellerCategory, error) {
	values := make(url.Values)
	if limit > 0 {
		values.Set("limit", strconv.Itoa(limit))
	}
	if offset > 0 {
		values.Set("offset", strconv.Itoa(offset))
	}

	var res SellerCategoryListResponse
	if err := c.get(ctx, "/internal/v1/categories", values, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return res.Items, nil
}
