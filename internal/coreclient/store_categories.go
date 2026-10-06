package coreclient

// Typed client methods for Core's store-scoped category endpoints. All data is
// scoped by (store, subject): Core enforces seller membership and returns
// not_found for foreign ids, which this client surfaces unchanged.

import (
	"context"
	"fmt"
	"net/url"
	"strconv"
	"time"
)

// StoreCategoryTranslation is one locale's content of a store category.
type StoreCategoryTranslation struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// StoreCategory is a flat tree node. The client assembles the hierarchy from
// ParentCategoryID; ProductCount and ChildCount drive confirmation dialogs.
type StoreCategory struct {
	ID               string                              `json:"id"`
	StoreID          string                              `json:"store_id"`
	ParentCategoryID *string                             `json:"parent_category_id"`
	Slug             string                              `json:"slug"`
	Status           string                              `json:"status"`
	SortOrder        int                                 `json:"sort_order"`
	Translations     map[string]StoreCategoryTranslation `json:"translations"`
	ProductCount     int                                 `json:"product_count"`
	ChildCount       int                                 `json:"child_count"`
	CreatedAt        time.Time                           `json:"created_at"`
	UpdatedAt        time.Time                           `json:"updated_at"`
}

// StoreCategoryListResponse is Core's list envelope for store categories.
type StoreCategoryListResponse struct {
	Items  []StoreCategory `json:"items"`
	Total  int             `json:"total"`
	Limit  int             `json:"limit"`
	Offset int             `json:"offset"`
}

// StoreCategoryInput is a create payload. Translations is keyed by locale
// ("en" required, "ar" optional).
type StoreCategoryInput struct {
	Slug             string                              `json:"slug"`
	ParentCategoryID *string                             `json:"parent_category_id,omitempty"`
	SortOrder        *int                                `json:"sort_order,omitempty"`
	Translations     map[string]StoreCategoryTranslation `json:"translations"`
}

// StoreCategoryUpdateInput is an update payload. Nil fields are left
// unchanged; ClearParent distinguishes "remove parent" from "leave alone".
type StoreCategoryUpdateInput struct {
	Slug             *string                             `json:"slug,omitempty"`
	ParentCategoryID *string                             `json:"parent_category_id,omitempty"`
	ClearParent      bool                                `json:"clear_parent,omitempty"`
	SortOrder        *int                                `json:"sort_order,omitempty"`
	Translations     map[string]StoreCategoryTranslation `json:"translations,omitempty"`
}

// StoreCategoryReorderEntry is one (category, sort order) pair.
type StoreCategoryReorderEntry struct {
	ID        string `json:"id"`
	SortOrder int    `json:"sort_order"`
}

type storeCategoryStatusResponse struct {
	Status string `json:"status"`
}

func (c *Client) ListStoreCategories(ctx context.Context, subject, storeID, status string, limit, offset int) ([]StoreCategory, error) {
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

	path := fmt.Sprintf("/internal/v1/stores/%s/categories", url.PathEscape(storeID))
	var res StoreCategoryListResponse
	if err := c.get(ctx, path, values, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return res.Items, nil
}

func (c *Client) CreateStoreCategory(ctx context.Context, subject, storeID string, input StoreCategoryInput) (*StoreCategory, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/categories", url.PathEscape(storeID))
	var res StoreCategory
	if err := c.post(ctx, path, input, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) GetStoreCategory(ctx context.Context, subject, storeID, categoryID string) (*StoreCategory, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/categories/%s", url.PathEscape(storeID), url.PathEscape(categoryID))
	var res StoreCategory
	if err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) UpdateStoreCategory(ctx context.Context, subject, storeID, categoryID string, input StoreCategoryUpdateInput) (*StoreCategory, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/categories/%s", url.PathEscape(storeID), url.PathEscape(categoryID))
	var res StoreCategory
	if err := c.put(ctx, path, input, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) UpdateStoreCategoryStatus(ctx context.Context, subject, storeID, categoryID, status string) (*StoreCategory, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/categories/%s/status", url.PathEscape(storeID), url.PathEscape(categoryID))
	body := map[string]string{"status": status}
	var res StoreCategory
	if err := c.post(ctx, path, body, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) DeleteStoreCategory(ctx context.Context, subject, storeID, categoryID string) error {
	path := fmt.Sprintf("/internal/v1/stores/%s/categories/%s", url.PathEscape(storeID), url.PathEscape(categoryID))
	var res map[string]any
	return c.delete(ctx, path, requestOptions{Subject: subject}, &res)
}

func (c *Client) ReorderStoreCategories(ctx context.Context, subject, storeID string, order []StoreCategoryReorderEntry) error {
	path := fmt.Sprintf("/internal/v1/stores/%s/categories/reorder", url.PathEscape(storeID))
	body := map[string]any{"order": order}
	var res StoreCategoryListResponse
	return c.post(ctx, path, body, requestOptions{Subject: subject}, &res)
}
