'use client';

import { dictionaryFor, isLocale, type Locale } from '../i18n/locales';
import { themeRegistry } from '../themes';

/**
 * The error boundary.
 *
 * An error boundary must be a Client Component: React needs the reset callback on the
 * client. It therefore has no access to server state, and reads the locale from the
 * document element the root layout already set.
 *
 * Nothing about the failure is displayed. The `error` prop carries a message and a
 * digest that can name the internal service address or reveal transport detail, so it
 * is not rendered and not logged to the browser console.
 */

export default function ErrorBoundary({ reset }: { error: Error; reset: () => void }) {
  const documentLocale =
    typeof document !== 'undefined' ? document.documentElement.getAttribute('lang') : null;
  const locale: Locale = isLocale(documentLocale) ? documentLocale : 'en';
  const { ErrorState } = themeRegistry.default().components;

  return <ErrorState locale={locale} copy={dictionaryFor(locale)} reset={reset} />;
}
