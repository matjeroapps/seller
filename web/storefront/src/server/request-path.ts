import 'server-only';

import { cache } from 'react';
import { headers } from 'next/headers';

import { isLocale, type Locale } from '../i18n/locales';
import { LOCALE_HEADER, PATH_HEADER } from '../lib/headers';

/**
 * Request path access.
 *
 * The proxy publishes the locale segment and the path within it. Both are read here
 * rather than in components, so a page never touches a raw header.
 *
 * The values are derived by this application from the request URL and are not
 * client-supplied: the proxy deletes every inbound `x-matjero-*` header before
 * setting them.
 */

/** The path within the locale, for example `/products` or `` for the home page. */
export const currentLocalePath = cache(async (): Promise<string> => {
  const value = (await headers()).get(PATH_HEADER) ?? '';
  // Defensive: only a rooted, single-slash path is ever used to build a link.
  return /^(\/[A-Za-z0-9._~%-]+)*$/.test(value) ? value : '';
});

/** The locale of the current request, when the path carries one. */
export const currentLocale = cache(async (): Promise<Locale | null> => {
  const value = (await headers()).get(LOCALE_HEADER) ?? '';
  return isLocale(value) ? value : null;
});
