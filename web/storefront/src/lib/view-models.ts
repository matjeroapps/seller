import { dictionaryFor, directionFor, type Dictionary, type Locale } from '../i18n/locales';
import { buildQueryString, type CatalogParams } from './catalog-query';
import { SORT_ORDERS } from './contracts';
import type {
  Availability,
  CategoryNode,
  Money,
  Pagination,
  ProductDetail,
  ProductListItem,
  PublicCurrency,
  SortOrder,
  StoreBootstrap
} from './contracts';
import { normalizeThemeSettings, safeUrl } from '../themes/settings';
import type {
  AvailabilityOption,
  CategoryCardModel,
  CategoryViewModel,
  DisplayPrice,
  HomeViewModel,
  PaginationModel,
  ProductCardModel,
  ProductDetailViewModel,
  ProductListViewModel,
  SearchViewModel,
  SortOption,
  ThemeContext,
  ThemeSettings
} from '../themes/contract';

/**
 * View models.
 *
 * This module is the only place a storefront API payload becomes something a theme
 * renders. Keeping the mapping here is what makes themes swappable: a second theme
 * receives exactly these objects, so no commerce or fetching code changes when the
 * component set changes.
 *
 * The public price is the only price that exists in the payload — the Seller listing
 * price Core computed. Nothing here derives, discounts or recomputes it, and there
 * is no field to expose a wholesale price, a supplier or a fee even accidentally.
 */

export const PLATFORM_DEFAULT_THEME = { key: 'matjero-default', version: '1.0.0' };

/** Longest description rendered on a product page. */
const MAX_DESCRIPTION_LENGTH = 4_000;

/** Longest card summary. Core already truncates to 240. */
const MAX_SUMMARY_LENGTH = 240;

/** Most images shown in a product gallery. */
const MAX_GALLERY_IMAGES = 8;

/** Most variants listed on a product page. */
const MAX_VARIANTS = 50;

function plainText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') {
    return '';
  }
  const cleaned = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

/**
 * formatPrice renders a minor-unit amount for display.
 *
 * The currency's minor unit comes from the store's market, so the fraction digits
 * match the currency rather than a hardcoded two. `Intl` is used with an explicit
 * currency code; when a runtime lacks data for a code it falls back to the code
 * itself rather than throwing mid-render.
 */
export function formatPrice(money: Money, currency: PublicCurrency, locale: Locale): DisplayPrice {
  const amountMinor = Number.isFinite(money?.amount_minor) ? money.amount_minor : 0;
  const code = typeof money?.currency === 'string' && money.currency ? money.currency : currency.code;
  const minorUnit = Number.isInteger(currency?.minor_unit) && currency.minor_unit >= 0 ? currency.minor_unit : 2;
  const major = amountMinor / 10 ** minorUnit;

  let formatted: string;
  try {
    formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: minorUnit,
      maximumFractionDigits: minorUnit
    }).format(major);
  } catch {
    formatted = `${code} ${major.toFixed(minorUnit)}`;
  }

  return { formatted, amountMinor, currency: code };
}

function availabilityLabel(availability: Availability | string, copy: Dictionary): string {
  return availability === 'in_stock' ? copy.availability.in_stock : copy.availability.out_of_stock;
}

/** Path helpers. Every segment is percent-encoded so a slug cannot alter the route. */
export function productHref(locale: Locale, slug: string): string {
  return `/${locale}/products/${encodeURIComponent(slug)}`;
}

export function categoryHref(locale: Locale, slug: string): string {
  return `/${locale}/categories/${encodeURIComponent(slug)}`;
}

export function toProductCard(
  item: ProductListItem,
  currency: PublicCurrency,
  locale: Locale,
  copy: Dictionary
): ProductCardModel {
  const imageUri = safeUrl(item.image?.uri, 2048);
  const name = plainText(item.name, 256);

  return {
    slug: item.slug,
    name,
    summary: plainText(item.summary, MAX_SUMMARY_LENGTH),
    price: formatPrice(item.price, currency, locale),
    image: imageUri
      ? // Alt text is frequently empty upstream; the product name is the accessible
        // fallback, which is more useful than a generic label.
        { uri: imageUri, alt: plainText(item.image?.alt_text, 256) || name }
      : null,
    category: item.category ? { slug: item.category.slug, name: plainText(item.category.name, 128) } : null,
    available: item.availability === 'in_stock',
    availabilityLabel: availabilityLabel(item.availability, copy),
    href: productHref(locale, item.slug)
  };
}

export function toCategoryCard(node: CategoryNode, locale: Locale): CategoryCardModel {
  return {
    slug: node.slug,
    name: plainText(node.name, 128),
    description: plainText(node.description, 480),
    productCount: Number.isFinite(node.product_count) ? node.product_count : 0,
    href: categoryHref(locale, node.slug)
  };
}

/** Top-level categories, in payload order. Core sorts by localized name. */
export function topLevelCategories(nodes: CategoryNode[], locale: Locale, limit = 12): CategoryCardModel[] {
  return nodes
    .filter((node) => !node.parent_slug)
    .slice(0, limit)
    .map((node) => toCategoryCard(node, locale));
}

function paginationModel(
  pagination: Pagination,
  params: CatalogParams,
  basePath: string
): PaginationModel {
  const limit = pagination.limit > 0 ? pagination.limit : params.limit;
  const pages = Math.max(1, Math.ceil((pagination.total || 0) / limit));
  const page = Math.min(Math.max(params.page, 1), pages);

  return {
    page,
    pages,
    total: pagination.total || 0,
    previousHref: page > 1 ? `${basePath}${buildQueryString(params, { page: page - 1 })}` : null,
    nextHref: page < pages ? `${basePath}${buildQueryString(params, { page: page + 1 })}` : null
  };
}

function sortOptions(params: CatalogParams, copy: Dictionary): SortOption[] {
  return SORT_ORDERS.map((value: SortOrder) => ({
    value,
    label: copy.filters.sortOptions[value],
    selected: params.sort === value || (params.sort === null && value === 'newest')
  }));
}

function availabilityOptions(params: CatalogParams, copy: Dictionary): AvailabilityOption[] {
  return [
    { value: '', label: copy.filters.any, selected: params.availability === null },
    { value: 'in_stock', label: copy.availability.in_stock, selected: params.availability === 'in_stock' },
    {
      value: 'out_of_stock',
      label: copy.availability.out_of_stock,
      selected: params.availability === 'out_of_stock'
    }
  ];
}

export function toProductListModel(input: {
  heading: string;
  items: ProductListItem[];
  pagination: Pagination;
  params: CatalogParams;
  basePath: string;
  currency: PublicCurrency;
  locale: Locale;
  copy: Dictionary;
}): ProductListViewModel {
  const { heading, items, pagination, params, basePath, currency, locale, copy } = input;

  return {
    heading,
    products: items.map((item) => toProductCard(item, currency, locale, copy)),
    pagination: paginationModel(pagination, params, basePath),
    sortOptions: sortOptions(params, copy),
    availabilityOptions: availabilityOptions(params, copy),
    formAction: basePath,
    keyword: params.keyword
  };
}

export function toCategoryModel(input: {
  category: CategoryNode;
  parent: CategoryNode | null;
  list: ProductListViewModel;
  locale: Locale;
}): CategoryViewModel {
  return {
    category: toCategoryCard(input.category, input.locale),
    parentName: input.parent ? plainText(input.parent.name, 128) : '',
    list: input.list
  };
}

export function toProductDetailModel(
  product: ProductDetail,
  currency: PublicCurrency,
  locale: Locale,
  copy: Dictionary
): ProductDetailViewModel {
  const name = plainText(product.name, 256);

  return {
    name,
    description: plainText(product.description, MAX_DESCRIPTION_LENGTH),
    price: formatPrice(product.price, currency, locale),
    available: product.availability === 'in_stock',
    availabilityLabel: availabilityLabel(product.availability, copy),
    images: (product.images ?? [])
      .slice(0, MAX_GALLERY_IMAGES)
      .map((image) => ({ uri: safeUrl(image.uri, 2048), alt: plainText(image.alt_text, 256) || name }))
      .filter((image) => image.uri !== ''),
    categories: (product.categories ?? []).map((category) => ({
      href: categoryHref(locale, category.slug),
      label: plainText(category.name, 128)
    })),
    variants: (product.variants ?? []).slice(0, MAX_VARIANTS).map((variant) => ({
      code: plainText(variant.code, 128),
      available: variant.availability === 'in_stock',
      availabilityLabel: availabilityLabel(variant.availability, copy),
      // The count of purchasable units, not their identifiers: a SKU id is an
      // internal handle a customer has no use for before a cart exists.
      skuCount: Array.isArray(variant.skus) ? variant.skus.length : 0
    }))
  };
}

export function toSearchModel(keyword: string, list: ProductListViewModel): SearchViewModel {
  return { keyword, list };
}

/**
 * toThemeContext builds the context every themed page receives.
 *
 * `currentPath` is the path within the locale (for example `/products`), used to
 * build the locale switch so switching language keeps the customer on the
 * equivalent page.
 */
export function toThemeContext(input: {
  store: StoreBootstrap;
  locale: Locale;
  availableLocales: Locale[];
  categories: CategoryNode[];
  currentPath: string;
  settings?: ThemeSettings;
}): ThemeContext {
  const { store, locale, availableLocales, categories, currentPath } = input;
  const copy = dictionaryFor(locale);
  const settings = input.settings ?? normalizeThemeSettings(store.theme, PLATFORM_DEFAULT_THEME);

  return {
    locale,
    direction: directionFor(locale),
    copy,
    settings,
    branding: {
      name: plainText(store.store_name, 128) || store.store_code,
      code: store.store_code,
      logoUrl: settings.logoUrl
    },
    currency: store.currency,
    navigationCategories: topLevelCategories(categories, locale),
    links: {
      home: `/${locale}`,
      products: `/${locale}/products`,
      categories: `/${locale}/categories`,
      search: `/${locale}/search`
    },
    localeLinks: availableLocales.map((candidate) => ({
      locale: candidate,
      label: copy.navigation.localeNames[candidate],
      href: `/${candidate}${currentPath}`,
      current: candidate === locale
    }))
  };
}

export function toHomeModel(input: {
  sections: HomeViewModel['sections'];
  settings: ThemeSettings;
  locale: Locale;
}): HomeViewModel {
  return {
    hero: input.settings.hero,
    sections: input.sections,
    browseAllHref: `/${input.locale}/products`
  };
}
