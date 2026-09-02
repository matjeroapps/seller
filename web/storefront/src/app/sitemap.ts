import type { MetadataRoute } from 'next';

import { isStorefrontApiError } from '../lib/api';
import { MAX_PAGE_SIZE } from '../lib/contracts';
import type { Locale } from '../i18n/locales';
import { localesFor } from '../server/presentation';
import { requestOrigin, localizedUrl, seoPath } from '../server/seo';
import { currentHost, loadStore, storefrontClient } from '../server/store-context';

async function allProductSlugs(host: string, locale: Locale): Promise<string[]> {
  const slugs: string[] = [];
  let offset = 0;

  while (true) {
    const page = await storefrontClient().products(host, locale, {
      limit: MAX_PAGE_SIZE,
      offset
    });
    slugs.push(...page.items.map((item) => item.slug));
    offset += page.items.length;
    if (page.items.length === 0 || offset >= page.pagination.total) {
      return slugs;
    }
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = await currentHost();
  if (!host) {
    return [];
  }

  let store;
  try {
    store = await loadStore(host, 'en');
  } catch (error) {
    if (!isStorefrontApiError(error) || error.kind !== 'not_found') {
      throw error;
    }
    try {
      store = await loadStore(host, 'ar');
    } catch (fallbackError) {
      if (!isStorefrontApiError(fallbackError) || fallbackError.kind !== 'not_found') {
        throw fallbackError;
      }
      return [];
    }
  }

  const origin = await requestOrigin(host);
  const entries: MetadataRoute.Sitemap = [];
  const client = storefrontClient();

  for (const locale of localesFor(store)) {
    entries.push({ url: localizedUrl(origin, locale, seoPath('home')) });
    entries.push({ url: localizedUrl(origin, locale, seoPath('products')) });

    const categories = await client.categories(host, locale);
    entries.push(
      ...categories.map((category) => ({
        url: localizedUrl(origin, locale, seoPath('category', category.slug))
      }))
    );

    const productSlugs = await allProductSlugs(host, locale);
    entries.push(
      ...productSlugs.map((slug) => ({
        url: localizedUrl(origin, locale, seoPath('product', slug))
      }))
    );
  }

  return entries;
}
