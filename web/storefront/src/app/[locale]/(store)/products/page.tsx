import { notFound } from 'next/navigation';

import { parseCatalogParams, toCatalogQuery, type SearchParamsInput } from '../../../../lib/catalog-query';
import { toProductListModel } from '../../../../lib/view-models';
import { isStorefrontApiError } from '../../../../lib/api';
import { loadPresentation } from '../../../../server/presentation';
import { storefrontClient } from '../../../../server/store-context';

/**
 * The product listing.
 *
 * Filter, sort and page state is read from the URL, so every listing is
 * server-rendered, shareable and back-button correct with no client state.
 *
 * Unrecognized values were already dropped during parsing, so a stale or hand-edited
 * link shows the catalog rather than an error. A genuine rejection from the service —
 * a filter that parsed but is not accepted — renders the empty state instead of a 404,
 * because the store exists and the customer simply asked for nothing.
 */

export default async function ProductsPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);
  const presentation = await loadPresentation(locale);
  const { context, host, store } = presentation;

  const catalogParams = parseCatalogParams(rawSearchParams);
  const query = toCatalogQuery(catalogParams);

  let page;
  try {
    page = await storefrontClient().products(host, context.locale, query);
  } catch (error) {
    if (isStorefrontApiError(error) && error.kind === 'invalid_request') {
      page = { items: [], pagination: { total: 0, limit: catalogParams.limit, offset: 0 } };
    } else if (isStorefrontApiError(error) && error.kind === 'not_found') {
      // The store stopped resolving between the layout and this read.
      notFound();
    } else {
      throw error;
    }
  }

  const model = toProductListModel({
    heading: context.copy.products.title,
    items: page.items,
    pagination: page.pagination,
    params: catalogParams,
    basePath: context.links.products,
    currency: store.currency,
    locale: context.locale,
    copy: context.copy
  });

  const { ProductList } = presentation.theme.components;
  return <ProductList context={context} model={model} />;
}
