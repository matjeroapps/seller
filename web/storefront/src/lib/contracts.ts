/**
 * Public storefront contracts.
 *
 * These types describe the JSON the Seller storefront API publishes at
 * `/v1/storefront/*`. They are declared here, in this repository, rather than
 * generated from another repository's OpenAPI document: the Repository
 * Independence Rule (ADR-017) forbids consuming a sibling repository's artifacts
 * at build time, and the small duplication is the accepted cost.
 *
 * Only fields the public API actually returns appear here. There is deliberately
 * no wholesale price, no supplier reference, no platform fee and no fulfillment
 * detail, because the public contract does not carry them and the storefront must
 * not be able to render what it cannot receive.
 */

/** Availability is derived by Core. These two values are the whole domain. */
export const AVAILABILITY = ['in_stock', 'out_of_stock'] as const;
export type Availability = (typeof AVAILABILITY)[number];

/** Sort orders the catalog read model accepts. */
export const SORT_ORDERS = ['newest', 'price_asc', 'price_desc', 'name_asc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

/** Page size bounds enforced by the catalog read model. */
export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 60;

export type Money = {
  amount_minor: number;
  currency: string;
};

export type PublicCurrency = {
  code: string;
  symbol: string;
  minor_unit: number;
};

/**
 * The published presentation contract of a storefront. Draft configuration never
 * reaches this payload; it stays behind Core's signed preview token.
 */
export type StoreTheme = {
  key: string;
  version: string;
  configuration: Record<string, unknown>;
  configuration_revision: number;
};

export type StoreBootstrap = {
  store_code: string;
  store_name: string;
  domain?: string;
  market: string;
  currency: PublicCurrency;
  timezone: string;
  default_locale: string;
  supported_locales: string[];
  settings: Record<string, unknown>;
  theme?: StoreTheme | null;
};

export type CategoryNode = {
  slug: string;
  name: string;
  description?: string;
  parent_slug?: string;
  product_count: number;
};

export type ProductImage = {
  uri: string;
  alt_text?: string;
};

export type CategoryRef = {
  slug: string;
  name: string;
};

export type ProductListItem = {
  slug: string;
  name: string;
  summary?: string;
  price: Money;
  image?: ProductImage | null;
  category?: CategoryRef | null;
  availability: Availability;
  variant_count: number;
};

export type PublicSKU = {
  id: string;
  availability: Availability;
};

export type PublicVariant = {
  code: string;
  availability: Availability;
  skus: PublicSKU[];
};

export type ProductDetail = {
  slug: string;
  name: string;
  description?: string;
  price: Money;
  availability: Availability;
  images: ProductImage[];
  categories: CategoryRef[];
  variants: PublicVariant[];
};

export type Pagination = {
  total: number;
  limit: number;
  offset: number;
};

export type ProductPage = {
  items: ProductListItem[];
  pagination: Pagination;
};

/** Browse and search parameters. Every field is optional; Core supplies defaults. */
export type CatalogQuery = {
  category?: string;
  keyword?: string;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  availability?: Availability;
  sort?: SortOrder;
  limit?: number;
  offset?: number;
};
