import type { ReactElement } from 'react';
import { render, type RenderResult } from '@testing-library/react';

import { dictionaryFor, type Locale } from '../../src/i18n/locales';
import { parseCatalogParams } from '../../src/lib/catalog-query';
import type { CategoryNode, StoreBootstrap } from '../../src/lib/contracts';
import { PLATFORM_DEFAULT_THEME, toThemeContext } from '../../src/lib/view-models';
import type { ThemeContext } from '../../src/themes/contract';
import { normalizeThemeSettings } from '../../src/themes/settings';

/**
 * Test helpers.
 *
 * `buildContext` assembles the same theme context the server builds, from the same
 * mapping code, so a component test exercises the production path rather than a
 * hand-written stand-in.
 *
 * `renderInDocument` renders into a document whose `lang` and `dir` are set the way the
 * root layout sets them, so a test can assert direction-dependent behaviour.
 */

export function buildContext(options: {
  store: StoreBootstrap;
  locale: Locale;
  categories?: CategoryNode[];
  availableLocales?: Locale[];
  currentPath?: string;
}): ThemeContext {
  const { store, locale } = options;
  return toThemeContext({
    store,
    locale,
    availableLocales: options.availableLocales ?? ['ar', 'en'],
    categories: options.categories ?? [],
    currentPath: options.currentPath ?? '',
    settings: normalizeThemeSettings(store.theme ?? null, PLATFORM_DEFAULT_THEME)
  });
}

export function renderInDocument(element: ReactElement, locale: Locale): RenderResult {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  return render(element);
}

export function catalogParams(search: Record<string, string> = {}) {
  return parseCatalogParams(search);
}

export function copyFor(locale: Locale) {
  return dictionaryFor(locale);
}
