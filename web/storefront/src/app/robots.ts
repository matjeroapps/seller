import type { MetadataRoute } from 'next';

import { locales } from '../i18n/locales';
import { isStorefrontApiError } from '../lib/api';
import { requestOrigin } from '../server/seo';
import { currentHost, loadStore } from '../server/store-context';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = await currentHost();
  if (!host) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  for (const locale of locales) {
    try {
      await loadStore(host, locale);
      return {
        rules: { userAgent: '*', allow: '/' },
        sitemap: new URL('/sitemap.xml', await requestOrigin(host)).toString()
      };
    } catch (error) {
      if (!isStorefrontApiError(error) || error.kind !== 'not_found') {
        throw error;
      }
    }
  }

  return { rules: { userAgent: '*', disallow: '/' } };
}
