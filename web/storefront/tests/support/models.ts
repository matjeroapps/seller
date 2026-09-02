import { dictionaryFor, type Locale } from '../../src/i18n/locales';
import { parseCatalogParams } from '../../src/lib/catalog-query';
import type { CategoryNode, ProductDetail, ProductPage, StoreBootstrap } from '../../src/lib/contracts';
import {
  categoryHref,
  toCategoryModel,
  toHomeModel,
  toProductCard,
  toProductDetailModel,
  toProductListModel,
  toSearchModel,
  topLevelCategories
} from '../../src/lib/view-models';
import type {
  CategoryViewModel,
  HomeViewModel,
  ProductDetailViewModel,
  ProductListViewModel,
  SearchViewModel,
  ThemeContext
} from '../../src/themes/contract';

/**
 * Page model builders.
 *
 * These mirror what the page loaders do after the API returns, using the same mapping
 * functions. A component test therefore renders the model the server would have built,
 * not an approximation of it.
 */

export function homeModel(options: {
  context: ThemeContext;
  store: StoreBootstrap;
  products?: ProductPage;
  categories?: CategoryNode[];
}): HomeViewModel {
  const { context, store } = options;
  const products = options.products?.items ?? [];
  const categories = options.categories ?? [];

  const sections = context.settings.homepageSections.map((section) => ({
    kind: section.kind,
    title: section.title,
    products:
      section.kind === 'category_grid'
        ? []
        : products.map((item) => toProductCard(item, store.currency, context.locale, context.copy)),
    categories: section.kind === 'category_grid' ? topLevelCategories(categories, context.locale, 8) : []
  }));

  return toHomeModel({ sections, settings: context.settings, locale: context.locale });
}

export function listModel(options: {
  context: ThemeContext;
  store: StoreBootstrap;
  page: ProductPage;
  search?: Record<string, string>;
  basePath?: string;
  heading?: string;
}): ProductListViewModel {
  const { context, store, page } = options;
  const params = parseCatalogParams(options.search ?? {});

  return toProductListModel({
    heading: options.heading ?? context.copy.products.title,
    items: page.items,
    pagination: page.pagination,
    params,
    basePath: options.basePath ?? context.links.products,
    currency: store.currency,
    locale: context.locale,
    copy: context.copy
  });
}

export function categoryModel(options: {
  context: ThemeContext;
  store: StoreBootstrap;
  category: CategoryNode;
  parent?: CategoryNode | null;
  page: ProductPage;
  search?: Record<string, string>;
}): CategoryViewModel {
  const { context, store, category, page } = options;

  return toCategoryModel({
    category,
    parent: options.parent ?? null,
    list: listModel({
      context,
      store,
      page,
      search: options.search,
      basePath: categoryHref(context.locale, category.slug),
      heading: category.name
    }),
    locale: context.locale
  });
}

export function detailModel(options: {
  context: ThemeContext;
  store: StoreBootstrap;
  product: ProductDetail;
}): ProductDetailViewModel {
  return toProductDetailModel(
    options.product,
    options.store.currency,
    options.context.locale,
    options.context.copy
  );
}

export function searchModel(options: {
  context: ThemeContext;
  store: StoreBootstrap;
  page: ProductPage;
  keyword: string;
}): SearchViewModel {
  const params = { q: options.keyword };
  return toSearchModel(
    parseCatalogParams(params).keyword,
    listModel({
      context: options.context,
      store: options.store,
      page: options.page,
      search: params,
      basePath: options.context.links.search,
      heading: options.context.copy.search.heading
    })
  );
}

export function emptyPage(limit = 24): ProductPage {
  return { items: [], pagination: { total: 0, limit, offset: 0 } };
}

export function copy(locale: Locale) {
  return dictionaryFor(locale);
}
