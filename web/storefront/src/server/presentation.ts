import 'server-only';

import { cache } from 'react';

import { dictionaryFor, isLocale, locales, type Dictionary, type Locale } from '../i18n/locales';
import { isStorefrontApiError } from '../lib/api';
import type { CategoryNode, StoreBootstrap } from '../lib/contracts';
import { PLATFORM_DEFAULT_THEME, toThemeContext } from '../lib/view-models';
import { themeRegistry } from '../themes';
import type { ThemeContext, ThemeDefinition, ThemeSettings } from '../themes/contract';
import { normalizeThemeSettings } from '../themes/settings';
import { currentLocalePath } from './request-path';
import { currentHost, currentPreviewToken, isPreviewInvalid, loadStore, storefrontClient } from './store-context';

/**
 * Page loading.
 *
 * Everything a themed page needs is assembled here: the tenant, the locale, the store
 * bootstrap, the navigation categories, the resolved theme and the finished theme
 * context. Themes are selected at the end of this process and receive view models,
 * which is why swapping one changes no code above this line.
 */

export type StorePresentation = {
  host: string;
  locale: Locale;
  store: StoreBootstrap;
  categories: CategoryNode[];
  theme: ThemeDefinition;
  settings: ThemeSettings;
  context: ThemeContext;
};

/** Why a storefront cannot be rendered. Both collapse to the same customer state. */
export type UnavailableReason = 'store_unresolved' | 'theme_unsupported';

export class StoreUnavailableError extends Error {
  readonly reason: UnavailableReason;

  constructor(reason: UnavailableReason, message: string) {
    super(message);
    this.name = 'StoreUnavailableError';
    this.reason = reason;
  }
}

export function isStoreUnavailable(error: unknown): error is StoreUnavailableError {
  return error instanceof StoreUnavailableError;
}

/**
 * localesFor intersects the store's published locale set with the ones this storefront
 * implements.
 *
 * A market may advertise a locale this build has no dictionary for; routing to it
 * would render English text under an Arabic `lang`. The result is ordered by the
 * store's own preference, with its default first.
 */
export function localesFor(store: StoreBootstrap): Locale[] {
  const supported = Array.isArray(store.supported_locales) ? store.supported_locales : [];
  const ordered = [store.default_locale, ...supported].filter(isLocale);
  const unique = [...new Set(ordered)];
  return unique.length > 0 ? unique : [...locales];
}

/** The locale a bare `/` resolves to: the store's default when this build serves it. */
export function defaultLocaleFor(store: StoreBootstrap): Locale {
  return localesFor(store)[0] ?? 'en';
}

/** Categories are needed by navigation on every page, so one read per request. */
const loadCategories = cache(async (host: string, locale: Locale): Promise<CategoryNode[]> => {
  try {
    return await storefrontClient().categories(host, locale);
  } catch (error) {
    // Navigation is not worth failing a product page over. A store whose category
    // read fails still has a catalog; the menu renders without categories.
    if (isStorefrontApiError(error) && error.kind !== 'not_found') {
      return [];
    }
    throw error;
  }
});

/**
 * loadPresentation resolves the store and its theme for the requested locale.
 *
 * It throws StoreUnavailableError when the store does not resolve publicly or when its
 * pinned theme version has no compatible component set. Any other failure — the
 * service unreachable, a malformed payload — propagates, because a temporary outage
 * must not be presented to a customer as a closed store.
 */
export const loadPresentation = cache(async (requestedLocale: string): Promise<StorePresentation> => {
  if (await isPreviewInvalid()) {
    throw new StoreUnavailableError('store_unresolved', 'invalid preview request');
  }

  const host = await currentHost();
  const previewToken = await currentPreviewToken();

  if (!isLocale(requestedLocale)) {
    throw new StoreUnavailableError('store_unresolved', 'unsupported locale segment');
  }

  let store: StoreBootstrap;
  try {
    store = await loadStore(host, requestedLocale, previewToken);
  } catch (error) {
    if (isStorefrontApiError(error) && error.kind === 'not_found') {
      throw new StoreUnavailableError('store_unresolved', 'store did not resolve for host');
    }
    throw error;
  }

  const available = localesFor(store);
  if (!available.includes(requestedLocale)) {
    // The locale exists in the platform but is not published by this store's market.
    throw new StoreUnavailableError('store_unresolved', 'locale not published by store');
  }

  const resolution = themeRegistry.resolve(store.theme ?? null);
  if (resolution.outcome !== 'resolved') {
    // An unknown key or an incompatible version is never rendered with a substitute
    // component set: a configuration written for one theme version cannot be assumed
    // safe to interpret with another.
    throw new StoreUnavailableError('theme_unsupported', `theme not supported: ${resolution.outcome}`);
  }

  const settings = normalizeThemeSettings(store.theme ?? null, PLATFORM_DEFAULT_THEME);
  const categories = await loadCategories(host, requestedLocale);

  return {
    host,
    locale: requestedLocale,
    store,
    categories,
    theme: resolution.theme,
    settings,
    context: toThemeContext({
      store,
      locale: requestedLocale,
      availableLocales: available,
      categories,
      currentPath: await currentLocalePath(),
      settings,
      previewToken
    })
  };
});

/** The locale to render a chrome-less state in. */
export function safeLocale(locale: string): Locale {
  return isLocale(locale) ? locale : 'en';
}

/** The dictionary for a possibly invalid locale segment. */
export function safeDictionary(locale: string): Dictionary {
  return dictionaryFor(safeLocale(locale));
}
