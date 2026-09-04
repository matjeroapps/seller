import type { Metadata } from 'next';

import { isStorefrontApiError } from '../../../../lib/api';
import { parseCatalogParams, toCatalogQuery, type SearchParamsInput } from '../../../../lib/catalog-query';
import type { ProductPage } from '../../../../lib/contracts';
import { toProductListModel, toSearchModel } from '../../../../lib/view-models';
import { loadPresentation } from '../../../../server/presentation';
import { currentPreviewToken, storefrontClient } from '../../../../server/store-context';
import { metadataForPage, requestOrigin } from '../../../../server/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  try {
    const { locale } = await params;
    const presentation = await loadPresentation(locale);
    const origin = await requestOrigin(presentation.host);

    return await metadataForPage({
      host: presentation.host,
      store: presentation.store,
      locale: presentation.locale,
      page: 'search',
      title: `${presentation.context.copy.search.heading} | ${presentation.store.store_name}`,
      description: presentation.context.copy.search.heading,
      indexable: false,
      origin
    });
  } catch {
    return {};
  }
}

/**
 * Search.
 *
 * The query comes from the URL and the search itself is performed by the storefront
 * API. Nothing is searched in the browser and no catalog is shipped to it: a
 * client-side search would need the whole catalog, would ignore the store's scope, and
 * would drift from the read model that produces every other listing.
 */

export default async function SearchPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);
  const presentation = await loadPresentation(locale);
  const { context, host, store } = presentation;
  const previewToken = await currentPreviewToken();

  const catalogParams = parseCatalogParams(rawSearchParams);
  const emptyPage: ProductPage = {
    items: [],
    pagination: { total: 0, limit: catalogParams.limit, offset: 0 }
  };

  let page = emptyPage;
  if (catalogParams.keyword) {
    try {
      page = await storefrontClient().search(host, context.locale, toCatalogQuery(catalogParams));
    } catch (error) {
      // A rejected search term is a normal customer state, not a failure: the page
      // renders with no results and an invitation to try another word.
      if (!isStorefrontApiError(error) || error.kind !== 'invalid_request') {
        throw error;
      }
    }
  }

  const list = toProductListModel({
    heading: context.copy.search.heading,
    items: page.items,
    pagination: page.pagination,
    params: catalogParams,
    basePath: context.links.search,
    currency: store.currency,
    locale: context.locale,
    copy: context.copy,
    previewToken
  });

  const { SearchResults } = presentation.theme.components;
  return <SearchResults context={context} model={toSearchModel(catalogParams.keyword, list)} />;
}
