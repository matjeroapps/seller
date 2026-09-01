package storefrontapi

import (
	"github.com/matjeroapps/core/pkg/storefront"
)

// Public API response contracts. They are declared here rather than reusing Core
// read structs directly as the JSON surface, so the customer-facing contract stays
// stable independently of the read model, and so no Core domain struct can become
// a public payload by accident.

// StoreResponse is the storefront bootstrap payload.
type StoreResponse struct {
	Store storefront.StoreBootstrap `json:"store"`
}

// CategoryCollectionResponse is the public category tree.
type CategoryCollectionResponse struct {
	Items []storefront.CategoryNode `json:"items"`
}

// CategoryResponse is a single public category.
type CategoryResponse struct {
	Category storefront.CategoryNode `json:"category"`
}

// Pagination is the public paging envelope for browse and search collections.
type Pagination struct {
	Total  int64 `json:"total"`
	Limit  int   `json:"limit"`
	Offset int   `json:"offset"`
}

// ProductCollectionResponse is a bounded page of browse or search results.
type ProductCollectionResponse struct {
	Items      []storefront.ProductListItem `json:"items"`
	Pagination Pagination                   `json:"pagination"`
}

// ProductResponse is the product detail payload.
type ProductResponse struct {
	Product storefront.ProductDetail `json:"product"`
}

func newProductCollectionResponse(page storefront.ProductPage) ProductCollectionResponse {
	items := page.Items
	if items == nil {
		items = []storefront.ProductListItem{}
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
