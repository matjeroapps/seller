import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, SORT_ORDERS } from './contracts';
import type { Availability, CatalogQuery, SortOrder } from './contracts';

/**
 * Catalog query parsing.
 *
 * Browse state lives entirely in the URL so every listing is server-renderable and
 * shareable. This module is the single place a query string becomes a typed query.
 *
 * Unrecognized and out-of-range values are dropped rather than forwarded. The
 * storefront API rejects them with a 400, and a customer following a stale or
 * hand-edited link should see the catalog, not an error page. Anything the API
 * genuinely needs to reject — a valid-looking but unavailable filter — still
 * reaches it.
 */

export type SearchParamsInput = Record<string, string | string[] | undefined>;

/** The parsed, URL-visible listing state. */
export type CatalogParams = {
  page: number;
  sort: SortOrder | null;
  availability: Availability | null;
  keyword: string;
  category: string;
  limit: number;
};

/** Longest accepted search keyword. Longer input is truncated, not rejected. */
const MAX_KEYWORD_LENGTH = 128;

/** Bounds pagination. Beyond this a listing is not a browsing experience. */
const MAX_PAGE = 1_000;

function single(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

function positiveInt(raw: string, fallback: number, max: number): number {
  if (!/^\d{1,7}$/.test(raw)) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (parsed < 1) {
    return fallback;
  }
  return parsed > max ? max : parsed;
}

export function parseCatalogParams(params: SearchParamsInput): CatalogParams {
  const sortRaw = single(params.sort);
  const availabilityRaw = single(params.availability);

  return {
    page: positiveInt(single(params.page), 1, MAX_PAGE),
    sort: (SORT_ORDERS as readonly string[]).includes(sortRaw) ? (sortRaw as SortOrder) : null,
    availability:
      availabilityRaw === 'in_stock' || availabilityRaw === 'out_of_stock'
        ? availabilityRaw
        : null,
    keyword: single(params.q).trim().slice(0, MAX_KEYWORD_LENGTH),
    category: single(params.category).trim().slice(0, 128),
    limit: Math.min(positiveInt(single(params.limit), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE), MAX_PAGE_SIZE)
  };
}

/** toCatalogQuery converts parsed params into an API query. */
export function toCatalogQuery(params: CatalogParams, overrides: Partial<CatalogQuery> = {}): CatalogQuery {
  return {
    limit: params.limit,
    offset: (params.page - 1) * params.limit,
    ...(params.sort ? { sort: params.sort } : {}),
    ...(params.availability ? { availability: params.availability } : {}),
    ...(params.keyword ? { keyword: params.keyword } : {}),
    ...(params.category ? { category: params.category } : {}),
    ...overrides
  };
}

/**
 * buildQueryString serializes listing state back into a query string.
 *
 * Values go through URLSearchParams, so a keyword containing `&`, `=` or a quote
 * cannot break out of its parameter.
 */
export function buildQueryString(
  params: CatalogParams,
  overrides: Partial<{ page: number; sort: SortOrder | null; availability: Availability | null; q: string }> = {}
): string {
  const merged = {
    page: overrides.page ?? params.page,
    sort: overrides.sort !== undefined ? overrides.sort : params.sort,
    availability: overrides.availability !== undefined ? overrides.availability : params.availability,
    q: overrides.q !== undefined ? overrides.q : params.keyword
  };

  const search = new URLSearchParams();
  if (merged.q) {
    search.set('q', merged.q);
  }
  if (merged.sort) {
    search.set('sort', merged.sort);
  }
  if (merged.availability) {
    search.set('availability', merged.availability);
  }
  if (merged.page > 1) {
    search.set('page', String(merged.page));
  }
  if (params.limit !== DEFAULT_PAGE_SIZE) {
    search.set('limit', String(params.limit));
  }

  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
}
