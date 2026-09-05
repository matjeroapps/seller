package storefrontapi

import (
	"github.com/matjeroapps/seller/internal/coreclient"
)

// Public API response contracts. They are declared here rather than reusing Core
// read structs directly as the JSON surface, so the customer-facing contract stays
// stable independently of the read model, and so no Core domain struct can become
// a public payload by accident.

// StoreResponse is the storefront bootstrap payload.
type StoreResponse struct {
	Store coreclient.StoreBootstrap `json:"store"`
}

// CategoryCollectionResponse is the public category tree.
type CategoryCollectionResponse struct {
	Items []coreclient.CategoryNode `json:"items"`
}

// CategoryResponse is a single public category.
type CategoryResponse struct {
	Category coreclient.CategoryNode `json:"category"`
}

// Pagination is the public paging envelope for browse and search collections.
type Pagination struct {
	Total  int64 `json:"total"`
	Limit  int   `json:"limit"`
	Offset int   `json:"offset"`
}

// ProductCollectionResponse is a bounded page of browse or search results.
type ProductCollectionResponse struct {
	Items      []coreclient.ProductListItem `json:"items"`
	Pagination Pagination                   `json:"pagination"`
}

// ProductResponse is the product detail payload.
type ProductResponse struct {
	Product coreclient.ProductDetail `json:"product"`
}

func newProductCollectionResponse(page coreclient.ProductPage) ProductCollectionResponse {
	items := page.Items
	if items == nil {
		items = []coreclient.ProductListItem{}
	}
	return ProductCollectionResponse{
		Items: items,
		Pagination: Pagination{
			Total:  page.Total,
			Limit:  page.Limit,
			Offset: page.Offset,
		},
	}
}

// OrderItemResponse represents a buyer-safe line item in an Order response.
type OrderItemResponse struct {
	ID                   string  `json:"id"`
	SKUID                *string `json:"sku_id,omitempty"`
	ProductTitleSnapshot string  `json:"product_title_snapshot"`
	SKUCodeSnapshot      string  `json:"sku_code_snapshot"`
	UnitPriceMinor       int64   `json:"unit_price_minor"`
	CurrencyCode         string  `json:"currency_code"`
	Quantity             int64   `json:"quantity"`
	LineTotalMinor       int64   `json:"line_total_minor"`
}

// OrderResponse represents a buyer-safe Order response.
type OrderResponse struct {
	ID                     string              `json:"id"`
	OrderNumber            string              `json:"order_number"`
	MarketCode             string              `json:"market_code"`
	Status                 string              `json:"status"`
	CurrencyCode           string              `json:"currency_code"`
	SubtotalMinor          int64               `json:"subtotal_minor"`
	TotalMinor             int64               `json:"total_minor"`
	ConfirmationDeadlineAt string              `json:"confirmation_deadline_at"`
	CancellationReason     *string             `json:"cancellation_reason,omitempty"`
	CreatedAt              string              `json:"created_at"`
	UpdatedAt              string              `json:"updated_at"`
	Items                  []OrderItemResponse `json:"items,omitempty"`
}

// ToOrderResponse maps an internal coreclient.PublicOrder into a buyer-safe OrderResponse DTO.
func ToOrderResponse(o coreclient.PublicOrder) OrderResponse {
	items := make([]OrderItemResponse, len(o.Items))
	for i, item := range o.Items {
		items[i] = OrderItemResponse{
			ID:                   item.ID,
			SKUID:                item.SKUID,
			ProductTitleSnapshot: item.ProductTitleSnapshot,
			SKUCodeSnapshot:      item.SKUCodeSnapshot,
			UnitPriceMinor:       item.UnitPriceMinor,
			CurrencyCode:         item.CurrencyCode,
			Quantity:             item.Quantity,
			LineTotalMinor:       item.LineTotalMinor,
		}
	}
	return OrderResponse{
		ID:                     o.ID,
		OrderNumber:            o.OrderNumber,
		MarketCode:             o.MarketCode,
		Status:                 o.Status,
		CurrencyCode:           o.CurrencyCode,
		SubtotalMinor:          o.SubtotalMinor,
		TotalMinor:             o.TotalMinor,
		ConfirmationDeadlineAt: o.ConfirmationDeadlineAt,
		CancellationReason:     o.CancellationReason,
		CreatedAt:              o.CreatedAt,
		UpdatedAt:              o.UpdatedAt,
		Items:                  items,
	}
}

