package coreclient

import (
	"context"
	"net/url"
	"strconv"

	"github.com/matjeroapps/seller/internal/i18n"
	"github.com/matjeroapps/seller/internal/money"
)

// Storefront DTOs.
//
// These mirror the public shapes the Seller storefront API publishes. They are
// owned here rather than shared with Core so the customer-facing contract is
// governed by this repository, and so a Core read-model change cannot silently
// alter a public payload.

// PublicCurrency is the customer-facing currency of a store's market.
type PublicCurrency struct {
	Code      string `json:"code"`
	Symbol    string `json:"symbol"`
	MinorUnit int    `json:"minor_unit"`
}

// StoreTheme is the published presentation contract for a storefront. Draft
// configuration never appears here; it stays behind the signed preview token.
type StoreTheme struct {
	Key                   string         `json:"key"`
	Version               string         `json:"version"`
	Configuration         map[string]any `json:"configuration"`
	ConfigurationRevision int            `json:"configuration_revision"`
}

// StoreBootstrap is the payload a storefront needs before it can render.
type StoreBootstrap struct {
	StoreCode        string         `json:"store_code"`
	StoreName        string         `json:"store_name"`
	Domain           string         `json:"domain,omitempty"`
	Market           string         `json:"market"`
	Currency         PublicCurrency `json:"currency"`
	Timezone         string         `json:"timezone"`
	DefaultLocale    string         `json:"default_locale"`
	SupportedLocales []string       `json:"supported_locales"`
	Settings         map[string]any `json:"settings"`
	Theme            *StoreTheme    `json:"theme,omitempty"`
}

// CategoryNode is a publicly visible category of a store.
type CategoryNode struct {
	Slug         string `json:"slug"`
	Name         string `json:"name"`
	Description  string `json:"description,omitempty"`
	ParentSlug   string `json:"parent_slug,omitempty"`
	ProductCount int64  `json:"product_count"`
}

// ProductImage is a customer-facing media reference.
type ProductImage struct {
	URI     string `json:"uri"`
	AltText string `json:"alt_text,omitempty"`
}

// CategoryRef is a minimal category reference embedded in product payloads.
type CategoryRef struct {
	Slug string `json:"slug"`
	Name string `json:"name"`
}

// ProductListItem is a browse-page row.
type ProductListItem struct {
	Slug         string        `json:"slug"`
	Name         string        `json:"name"`
	Summary      string        `json:"summary,omitempty"`
	Price        money.Money   `json:"price"`
	Image        *ProductImage `json:"image,omitempty"`
	Category     *CategoryRef  `json:"category,omitempty"`
	Availability string        `json:"availability"`
	VariantCount int64         `json:"variant_count"`
}

// PublicSKU is the selectable unit for a future cart.
type PublicSKU struct {
	ID           string `json:"id"`
	Availability string `json:"availability"`
}

// PublicVariant is a customer-selectable variant of a product.
type PublicVariant struct {
	Code         string      `json:"code"`
	Availability string      `json:"availability"`
	SKUs         []PublicSKU `json:"skus"`
}

// ProductDetail is the product page payload.
type ProductDetail struct {
	Slug         string          `json:"slug"`
	Name         string          `json:"name"`
	Description  string          `json:"description,omitempty"`
	Price        money.Money     `json:"price"`
	Availability string          `json:"availability"`
	Images       []ProductImage  `json:"images"`
	Categories   []CategoryRef   `json:"categories"`
	Variants     []PublicVariant `json:"variants"`
}

// ProductPage is a bounded page of browse results.
type ProductPage struct {
	Items  []ProductListItem `json:"items"`
	Total  int64             `json:"total"`
	Limit  int               `json:"limit"`
	Offset int               `json:"offset"`
}

// ProductQuery is the domain-neutral browse/search request. It exposes no
// storage-specific concepts, so Core can move to a dedicated search read model
// without changing this contract.
type ProductQuery struct {
	CategorySlug  string
	Keyword       string
	MinPriceMinor *int64
	MaxPriceMinor *int64
	Availability  string
	Sort          string
	Limit         *int64
	Offset        *int64
}

// Storefront response envelopes.

type storefrontStoreResponse struct {
	Store StoreBootstrap `json:"store"`
}

type storefrontCategoryResponse struct {
	Category CategoryNode `json:"category"`
}

type storefrontProductResponse struct {
	Product ProductDetail `json:"product"`
}

type storefrontProductPageResponse struct {
	Items      []ProductListItem `json:"items"`
	Pagination struct {
		Total  int64 `json:"total"`
		Limit  int   `json:"limit"`
		Offset int   `json:"offset"`
	} `json:"pagination"`
}

type storefrontCategoryCollection struct {
	Items []CategoryNode `json:"items"`
}

// StorefrontStore resolves the storefront bootstrap for a trusted host.
//
// The host is the tenant authority. It is computed by the Seller API from its own
// trusted-proxy policy and forwarded to Core, which resolves the store itself.
//
// The returned revision is the cache generation Core labelled this payload with,
// and is 0 when the response carried no label. A caller that caches the payload
// must store it under this value, never under a revision it probed earlier.
func (c *Client) StorefrontStore(ctx context.Context, host string, locale i18n.Locale) (StoreBootstrap, int64, error) {
	var payload storefrontStoreResponse
	header, err := c.getWithHeader(ctx, "/internal/v1/storefront/store", nil, requestOptions{
		StorefrontHost: host,
		Locale:         string(locale),
	}, &payload)
	return payload.Store, revisionFrom(header), err
}

// StorefrontStorePreview resolves the storefront bootstrap using a draft theme preview token.
//
// The preview token is forwarded to Core in X-Matjero-Storefront-Preview. The returned
// response carries the validated draft theme configuration and must not be stored in cache.
func (c *Client) StorefrontStorePreview(ctx context.Context, host, previewToken string, locale i18n.Locale) (StoreBootstrap, error) {
	var payload storefrontStoreResponse
	_, err := c.getWithHeader(ctx, "/internal/v1/storefront/store", nil, requestOptions{
		StorefrontHost:    host,
		StorefrontPreview: previewToken,
		Locale:            string(locale),
	}, &payload)
	return payload.Store, err
}

// StorefrontCategories lists the public category tree for a host.
func (c *Client) StorefrontCategories(ctx context.Context, host string, locale i18n.Locale) ([]CategoryNode, int64, error) {
	var payload storefrontCategoryCollection
	header, err := c.getWithHeader(ctx, "/internal/v1/storefront/categories", nil, requestOptions{
		StorefrontHost: host,
		Locale:         string(locale),
	}, &payload)
	return payload.Items, revisionFrom(header), err
}

// StorefrontCategory resolves a single public category by slug.
func (c *Client) StorefrontCategory(ctx context.Context, host, slug string, locale i18n.Locale) (CategoryNode, int64, error) {
	var payload storefrontCategoryResponse
	path := "/internal/v1/storefront/categories/" + url.PathEscape(slug)
	header, err := c.getWithHeader(ctx, path, nil, requestOptions{
		StorefrontHost: host,
		Locale:         string(locale),
	}, &payload)
	return payload.Category, revisionFrom(header), err
}

// StorefrontProducts browses the public catalog for a host.
func (c *Client) StorefrontProducts(ctx context.Context, host string, query ProductQuery, locale i18n.Locale) (ProductPage, int64, error) {
	var payload storefrontProductPageResponse
	header, err := c.getWithHeader(ctx, "/internal/v1/storefront/products", productQueryValues(query), requestOptions{
		StorefrontHost: host,
		Locale:         string(locale),
	}, &payload)
	return productPageFrom(payload), revisionFrom(header), err
}

// StorefrontProduct resolves a single public product by slug.
func (c *Client) StorefrontProduct(ctx context.Context, host, slug string, locale i18n.Locale) (ProductDetail, int64, error) {
	var payload storefrontProductResponse
	path := "/internal/v1/storefront/products/" + url.PathEscape(slug)
	header, err := c.getWithHeader(ctx, path, nil, requestOptions{
		StorefrontHost: host,
		Locale:         string(locale),
	}, &payload)
	return payload.Product, revisionFrom(header), err
}

// StorefrontSearch searches the public catalog for a host.
func (c *Client) StorefrontSearch(ctx context.Context, host string, query ProductQuery, locale i18n.Locale) (ProductPage, int64, error) {
	var payload storefrontProductPageResponse
	header, err := c.getWithHeader(ctx, "/internal/v1/storefront/search", productQueryValues(query), requestOptions{
		StorefrontHost: host,
		Locale:         string(locale),
	}, &payload)
	return productPageFrom(payload), revisionFrom(header), err
}

func productPageFrom(payload storefrontProductPageResponse) ProductPage {
	items := payload.Items
	if items == nil {
		items = []ProductListItem{}
	}
	return ProductPage{
		Items:  items,
		Total:  payload.Pagination.Total,
		Limit:  payload.Pagination.Limit,
		Offset: payload.Pagination.Offset,
	}
}

// productQueryValues serializes a browse query. Absent optional values are
// omitted rather than sent as empty strings, so Core's defaults apply.
func productQueryValues(query ProductQuery) url.Values {
	values := url.Values{}
	if query.CategorySlug != "" {
		values.Set("category", query.CategorySlug)
	}
	if query.Keyword != "" {
		values.Set("q", query.Keyword)
	}
	if query.Availability != "" {
		values.Set("availability", query.Availability)
	}
	if query.Sort != "" {
		values.Set("sort", query.Sort)
	}
	if query.MinPriceMinor != nil {
		values.Set("min_price", strconv.FormatInt(*query.MinPriceMinor, 10))
	}
	if query.MaxPriceMinor != nil {
		values.Set("max_price", strconv.FormatInt(*query.MaxPriceMinor, 10))
	}
	if query.Limit != nil {
		values.Set("limit", strconv.FormatInt(*query.Limit, 10))
	}
	if query.Offset != nil {
		values.Set("offset", strconv.FormatInt(*query.Offset, 10))
	}
	return values
}
