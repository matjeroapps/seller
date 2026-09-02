import { notFound } from 'next/navigation';

import { isStorefrontApiError } from '../../../../../lib/api';
import { parseCatalogParams, toCatalogQuery, type SearchParamsInput } from '../../../../../lib/catalog-query';
import { categoryHref, toCategoryModel, toProductListModel } from '../../../../../lib/view-models';
import { loadPresentation } from '../../../../../server/presentation';
import { storefrontClient } from '../../../../../server/store-context';

/**
 * The category page.
 *
 * The category and its products are read together: they are independent requests, and
 * a customer waiting for two sequential round trips would see nothing until both
 * finish.
 *
 * The category read is scoped by the trusted host, so an unknown slug is a 404 for
 * this store and never resolves to another store's category of the same name.
 */

export default async function CategoryPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const [{ locale, slug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const presentation = await loadPresentation(locale);
  const { categories, context, host, store } = presentation;

  const catalogParams = parseCatalogParams(rawSearchParams);
  const client = storefrontClient();

  const [category, page] = await Promise.all([
    client.category(host, context.locale, slug).catch((error: unknown) => {
      if (isStorefrontApiError(error) && (error.kind === 'not_found' || error.kind === 'invalid_request')) {
        notFound();
      }
      throw error;
    }),
    client
      .products(host, context.locale, toCatalogQuery(catalogParams, { category: slug }))
      .catch((error: unknown) => {
        if (isStorefrontApiError(error) && error.kind === 'invalid_request') {
          return { items: [], pagination: { total: 0, limit: catalogParams.limit, offset: 0 } };
        }
        throw error;
      })
  ]);

  const list = toProductListModel({
    heading: category.name,
    items: page.items,
    pagination: page.pagination,
    params: catalogParams,
    basePath: categoryHref(context.locale, slug),
    currency: store.currency,
    locale: context.locale,
    copy: context.copy
  });

  const model = toCategoryModel({
    category,
    // The parent name comes from the category tree already loaded for navigation, so
    // the breadcrumb costs no extra request.
    parent: categories.find((node) => node.slug === category.parent_slug) ?? null,
    list,
    locale: context.locale
  });

  const { Category } = presentation.theme.components;
  return <Category context={context} model={model} />;
}
