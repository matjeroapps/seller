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
	Locale          string `json:"locale"`
	Name            string `json:"name"`
	Description     string `json:"description"`
	MetaTitle       string `json:"meta_title,omitempty"`
	MetaDescription string `json:"meta_description,omitempty"`
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

type AttributeValueMapping struct {
	AttributeID      string `json:"attribute_id"`
	AttributeValueID string `json:"attribute_value_id"`
}

type VariantDimensionsDTO struct {
	LengthMM *int `json:"length_mm,omitempty"`
	WidthMM  *int `json:"width_mm,omitempty"`
	HeightMM *int `json:"height_mm,omitempty"`
}

type CreateVariantParams struct {
	Code            string                  `json:"code"`
	Status          string                  `json:"status"`
	SKUCode         *string                 `json:"sku_code,omitempty"`
	Barcode         *string                 `json:"barcode,omitempty"`
	AttributeValues []AttributeValueMapping `json:"attribute_values,omitempty"`
	WeightGrams     *int                    `json:"weight_grams,omitempty"`
	Dimensions      *VariantDimensionsDTO   `json:"dimensions,omitempty"`
	PriceMinorUnits *int64                  `json:"price_minor_units,omitempty"`
}

type VariantAttributeValueDetail struct {
	ID            string `json:"id"`
	AttributeID   string `json:"attribute_id"`
	AttributeName string `json:"attribute_name"`
	AttributeCode string `json:"attribute_code"`
	ValueID       string `json:"value_id"`
	ValueName     string `json:"value_name"`
	ValueCode     string `json:"value_code"`
}

type VariantWithDetails struct {
	ID              string                        `json:"id"`
	ProductID       string                        `json:"product_id"`
	Code            string                        `json:"code"`
	Status          string                        `json:"status"`
	AttributeValues []VariantAttributeValueDetail `json:"attribute_values,omitempty"`
	SKU             *SKU                          `json:"sku,omitempty"`
	CreatedAt       time.Time                     `json:"created_at,omitempty"`
	UpdatedAt       time.Time                     `json:"updated_at,omitempty"`
}

type SKU struct {
	ID              string    `json:"id"`
	VariantID       string    `json:"variant_id"`
	Code            string    `json:"code"`
	Barcode         *string   `json:"barcode,omitempty"`
	Status          string    `json:"status"`
	WeightGrams     *int      `json:"weight_grams,omitempty"`
	LengthMM        *int      `json:"length_mm,omitempty"`
	WidthMM         *int      `json:"width_mm,omitempty"`
	HeightMM        *int      `json:"height_mm,omitempty"`
	PriceMinorUnits *int64    `json:"price_minor_units,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type CreateSKUParams struct {
	Code            string  `json:"code"`
	Barcode         *string `json:"barcode,omitempty"`
	Status          string  `json:"status"`
	WeightGrams     *int    `json:"weight_grams,omitempty"`
	LengthMM        *int    `json:"length_mm,omitempty"`
	WidthMM         *int    `json:"width_mm,omitempty"`
	HeightMM        *int    `json:"height_mm,omitempty"`
	PriceMinorUnits *int64  `json:"price_minor_units,omitempty"`
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

type DualModeAdjustmentRequest struct {
	FulfillmentLocationID string `json:"fulfillment_location_id"`
	SKUID                 string `json:"sku_id"`
	QtyDelta              *int64 `json:"qty_delta,omitempty"`
	TargetQty             *int64 `json:"target_qty,omitempty"`
	ReasonCode            string `json:"reason_code"`
	Note                  string `json:"note,omitempty"`
}

type DualModeAdjustmentResponse struct {
	SnapshotID            string    `json:"snapshot_id"`
	FulfillmentLocationID string    `json:"fulfillment_location_id"`
	SKUID                 string    `json:"sku_id"`
	OnHandQty             int64     `json:"on_hand_qty"`
	ReservedQty           int64     `json:"reserved_qty"`
	AvailableQty          int64     `json:"available_qty"`
	QuantityDelta         int64     `json:"quantity_delta"`
	MovementID            string    `json:"movement_id"`
	ReasonCode            string    `json:"reason_code"`
	UpdatedAt             time.Time `json:"updated_at"`
}

type SellerOrderItem struct {
	ID          string `json:"id"`
	ProductName string `json:"product_name"`
	SKUCode     string `json:"sku_code"`
	Quantity    int    `json:"quantity"`
	UnitPrice   int64  `json:"unit_price"`
	TotalPrice  int64  `json:"total_price"`
	// Source documents the line item provenance. Core normalizes the value to
	// seller_owned or supplier_backed; the openapi tag only documents the
	// closed value set in the generated spec and never changes the wire shape.
	Source string `json:"source" openapi:"enum=seller_owned|supplier_backed"`
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
	return c.CreateVariantWithAttributes(ctx, subject, storeID, productID, code, status, nil)
}

func (c *Client) CreateVariantWithAttributes(ctx context.Context, subject, storeID, productID, code, status string, attributeValues []AttributeValueMapping) (*Variant, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/products/%s/variants", url.PathEscape(storeID), url.PathEscape(productID))
	body := map[string]any{"code": code, "status": status}
	if len(attributeValues) > 0 {
		body["attribute_values"] = attributeValues
	}
	var res Variant
	if err := c.post(ctx, path, body, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) CreateVariantWithOptions(ctx context.Context, subject, storeID, productID string, params CreateVariantParams) (*VariantWithDetails, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/products/%s/variants", url.PathEscape(storeID), url.PathEscape(productID))
	var res VariantWithDetails
	if err := c.post(ctx, path, params, requestOptions{Subject: subject}, &res); err != nil {
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
	return c.CreateSKUWithSpecs(ctx, subject, storeID, productID, variantID, CreateSKUParams{
		Code:    code,
		Barcode: barcode,
		Status:  status,
	})
}

func (c *Client) CreateSKUWithSpecs(ctx context.Context, subject, storeID, productID, variantID string, params CreateSKUParams) (*SKU, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/products/%s/variants/%s/skus", url.PathEscape(storeID), url.PathEscape(productID), url.PathEscape(variantID))
	var res SKU
	if err := c.post(ctx, path, params, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) UpdateSKU(ctx context.Context, subject, storeID, productID, variantID, skuID, code string, barcode *string, status string) (*SKU, error) {
	return c.UpdateSKUWithSpecs(ctx, subject, storeID, productID, variantID, skuID, CreateSKUParams{
		Code:    code,
		Barcode: barcode,
		Status:  status,
	})
}

func (c *Client) UpdateSKUWithSpecs(ctx context.Context, subject, storeID, productID, variantID, skuID string, params CreateSKUParams) (*SKU, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/products/%s/variants/%s/skus/%s", url.PathEscape(storeID), url.PathEscape(productID), url.PathEscape(variantID), url.PathEscape(skuID))
	var res SKU
	if err := c.put(ctx, path, params, requestOptions{Subject: subject}, &res); err != nil {
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

func (c *Client) AdjustStoreInventoryDualMode(ctx context.Context, subject, storeID string, reqDTO DualModeAdjustmentRequest, idempotencyKey string) (*DualModeAdjustmentResponse, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/inventory/adjustments", url.PathEscape(storeID))
	var res DualModeAdjustmentResponse
	opts := requestOptions{
		Subject:        subject,
		IdempotencyKey: idempotencyKey,
	}
	if err := c.post(ctx, path, reqDTO, opts, &res); err != nil {
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

// TransitionProductStatus transitions seller-owned product status (draft -> active).
func (c *Client) TransitionProductStatus(ctx context.Context, subject, storeID, productID, status string) (string, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/products/%s/status", url.PathEscape(storeID), url.PathEscape(productID))
	body := map[string]string{"status": status}
	var res statusResponse
	if err := c.post(ctx, path, body, requestOptions{Subject: subject}, &res); err != nil {
		return "", err
	}
	return res.Status, nil
}

// ArchiveProduct archives a seller-owned product.
func (c *Client) ArchiveProduct(ctx context.Context, subject, storeID, productID string) error {
	path := fmt.Sprintf("/internal/v1/stores/%s/products/%s/archive", url.PathEscape(storeID), url.PathEscape(productID))
	return c.post(ctx, path, nil, requestOptions{Subject: subject}, nil)
}

// StoreMediaAsset is an immutable store-owned binary media asset.
type StoreMediaAsset struct {
	ID               string    `json:"id"`
	StoreID          string    `json:"store_id"`
	ChecksumSHA256   string    `json:"checksum_sha256"`
	StorageKey       string    `json:"storage_key,omitempty"`
	ContentType      string    `json:"content_type"`
	ByteSize         int64     `json:"byte_size"`
	OriginalFilename string    `json:"original_filename"`
	Status           string    `json:"status"`
	URL              string    `json:"url"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// StoreMediaListResponse is the paginated response for ready store media assets.
type StoreMediaListResponse struct {
	Items  []StoreMediaAsset `json:"items"`
	Assets []StoreMediaAsset `json:"assets,omitempty"`
	Total  int               `json:"total"`
	Limit  int               `json:"limit"`
	Offset int               `json:"offset"`
}

// ListStoreMedia lists ready media assets owned by a store.
func (c *Client) ListStoreMedia(ctx context.Context, subject, storeID, filename, contentType string, limit, offset int) (*StoreMediaListResponse, error) {
	values := make(url.Values)
	if filename != "" {
		values.Set("filename", filename)
	}
	if contentType != "" {
		values.Set("content_type", contentType)
	}
	if limit > 0 {
		values.Set("limit", strconv.Itoa(limit))
	}
	if offset > 0 {
		values.Set("offset", strconv.Itoa(offset))
	}
	path := fmt.Sprintf("/internal/v1/stores/%s/media", url.PathEscape(storeID))
	var res StoreMediaListResponse
	if err := c.get(ctx, path, values, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	if len(res.Items) == 0 && len(res.Assets) > 0 {
		res.Items = res.Assets
	}
	res.Assets = nil
	return &res, nil
}

// PresignMediaUploadRequest is the payload to request an upload intent or asset reuse.
type PresignMediaUploadRequest struct {
	ClientUploadID string `json:"client_upload_id"`
	Filename       string `json:"filename"`
	ContentType    string `json:"content_type"`
	SizeBytes      int64  `json:"size_bytes"`
	ChecksumSHA256 string `json:"checksum_sha256"`
}

// PresignMediaUploadResponse is Core's discriminated upload/reuse response.
type PresignMediaUploadResponse struct {
	Mode            string            `json:"mode"`
	IntentID        string            `json:"intent_id,omitempty"`
	UploadURL       string            `json:"upload_url,omitempty"`
	UploadToken     string            `json:"upload_token,omitempty"`
	RequiredHeaders map[string]string `json:"required_headers,omitempty"`
	ExpiresAt       *time.Time        `json:"expires_at,omitempty"`
	Asset           *StoreMediaAsset  `json:"asset,omitempty"`
}

// PresignStoreMediaUpload requests asset reuse or a presigned upload URL for a store media file.
func (c *Client) PresignStoreMediaUpload(ctx context.Context, subject, storeID string, req PresignMediaUploadRequest) (*PresignMediaUploadResponse, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/media/uploads", url.PathEscape(storeID))
	var res PresignMediaUploadResponse
	if err := c.post(ctx, path, req, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

// CompleteStoreMediaUploadRequest is the completion payload for an upload intent.
type CompleteStoreMediaUploadRequest struct {
	UploadToken string `json:"upload_token"`
}

// CompleteStoreMediaUploadIntent verifies and accepts an uploaded object as a store media asset.
func (c *Client) CompleteStoreMediaUploadIntent(ctx context.Context, subject, storeID, intentID string, req CompleteStoreMediaUploadRequest) (*StoreMediaAsset, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/media/uploads/%s/complete", url.PathEscape(storeID), url.PathEscape(intentID))
	var res StoreMediaAsset
	if err := c.post(ctx, path, req, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

// DeleteStoreMediaAsset enqueues safe permanent deletion for an unreferenced store asset.
func (c *Client) DeleteStoreMediaAsset(ctx context.Context, subject, storeID, assetID string) error {
	path := fmt.Sprintf("/internal/v1/stores/%s/media/%s", url.PathEscape(storeID), url.PathEscape(assetID))
	return c.delete(ctx, path, requestOptions{Subject: subject}, nil)
}

// ProductMediaReference represents a product's reference to a store media asset.
type ProductMediaReference struct {
	ID        string    `json:"id"`
	StoreID   string    `json:"store_id"`
	ProductID string    `json:"product_id"`
	AssetID   string    `json:"asset_id"`
	AltText   string    `json:"alt_text"`
	SortOrder int       `json:"sort_order"`
	IsPrimary bool      `json:"is_primary"`
	URL       string    `json:"url,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ProductMediaReferenceListResponse is the list envelope for product media references.
type ProductMediaReferenceListResponse struct {
	References []ProductMediaReference `json:"references"`
}

// ListProductMediaReferences lists media references attached to a product.
func (c *Client) ListProductMediaReferences(ctx context.Context, subject, storeID, productID string) ([]ProductMediaReference, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/products/%s/media-references", url.PathEscape(storeID), url.PathEscape(productID))
	var res ProductMediaReferenceListResponse
	if err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return res.References, nil
}

// AttachMediaReferenceRequest payload to attach a store asset to a product.
type AttachMediaReferenceRequest struct {
	AssetID   string `json:"asset_id"`
	AltText   string `json:"alt_text"`
	SortOrder int    `json:"sort_order"`
	IsPrimary bool   `json:"is_primary"`
}

// AttachProductMediaReference attaches a store asset as a reference to a product.
func (c *Client) AttachProductMediaReference(ctx context.Context, subject, storeID, productID string, req AttachMediaReferenceRequest) (*ProductMediaReference, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/products/%s/media-references", url.PathEscape(storeID), url.PathEscape(productID))
	var res ProductMediaReference
	if err := c.post(ctx, path, req, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

// UpdateMediaReferenceRequest payload to edit reference metadata.
type UpdateMediaReferenceRequest struct {
	AltText   string `json:"alt_text"`
	SortOrder int    `json:"sort_order"`
	IsPrimary bool   `json:"is_primary"`
}

// UpdateProductMediaReference updates reference alt text, sort order, or primary flag.
func (c *Client) UpdateProductMediaReference(ctx context.Context, subject, storeID, productID, referenceID string, req UpdateMediaReferenceRequest) (*ProductMediaReference, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/products/%s/media-references/%s", url.PathEscape(storeID), url.PathEscape(productID), url.PathEscape(referenceID))
	var res ProductMediaReference
	if err := c.put(ctx, path, req, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

// DetachProductMediaReference detaches a media reference from a product.
func (c *Client) DetachProductMediaReference(ctx context.Context, subject, storeID, productID, referenceID string) error {
	path := fmt.Sprintf("/internal/v1/stores/%s/products/%s/media-references/%s", url.PathEscape(storeID), url.PathEscape(productID), url.PathEscape(referenceID))
	return c.delete(ctx, path, requestOptions{Subject: subject}, nil)
}
