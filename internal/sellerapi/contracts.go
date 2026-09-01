package sellerapi

import (
	"github.com/matjeroapps/seller/internal/coreclient"
)

// Public request and response contracts for the Seller API.
//
// These are owned by this repository. They are deliberately not the Core wire
// shapes: the public contract is governed here, so a Core change cannot silently
// alter what a seller-facing client sees.

type SellerProfileResponse struct {
	Seller   coreclient.Seller `json:"seller"`
	Settings map[string]any    `json:"settings"`
}

type SellerProfileUpdateRequest struct {
	Name     string         `json:"name"`
	Status   string         `json:"status"`
	Settings map[string]any `json:"settings"`
}

type SellerStoreCreateRequest struct {
	MarketCode string         `json:"market_code"`
	Code       string         `json:"code"`
	Name       string         `json:"name"`
	Status     string         `json:"status"`
	Settings   map[string]any `json:"settings"`
}

type SellerListingImportRequest struct {
	StoreID         string  `json:"store_id"`
	ProductID       string  `json:"product_id"`
	SupplierOfferID *string `json:"supplier_offer_id"`
	Status          string  `json:"status"`
	MarketCode      string  `json:"market_code"`
}

type SellerListingPriceRequest struct {
	AmountMinor int64  `json:"amount_minor"`
	Currency    string `json:"currency"`
}
