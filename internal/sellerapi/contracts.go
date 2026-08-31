package sellerapi

import (
	"github.com/matjeroapps/core/pkg/commerce"
)

type SellerProfileResponse struct {
	Seller   commerce.Seller `json:"seller"`
	Settings map[string]any  `json:"settings"`
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
