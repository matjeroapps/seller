import type { Metadata } from 'next';

import { directionFor, type Locale } from '../i18n/locales';
import { currentLocale } from '../server/request-path';
import '../styles.css';

/**
 * The document.
 *
 * This is the single root layout, so it owns `<html>` and therefore `lang` and `dir`.
 * Both are real attributes rather than CSS rules, because bidirectional text, logical
 * properties, caret movement and keyboard navigation follow the document direction and
 * not a stylesheet.
 *
 * A root layout sits above the `[locale]` segment and cannot read that parameter, so
 * the locale arrives as a request header the proxy derived from the path. It is not
 * client-controlled: the proxy deletes every inbound header in that namespace before
 * setting one.
 *
 * No store data is read here. The document shell must be correct even when the store
 * behind it cannot be loaded, which is what lets the unavailable page render inside a
 * well-formed document.
 */

export const metadata: Metadata = {
  // Deliberately minimal. Canonicals, alternates, social cards and structured data
  // belong to the SEO unit, not to rendering.
  title: 'Storefront'
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale: Locale = (await currentLocale()) ?? 'en';

  return (
    <html lang={locale} dir={directionFor(locale)}>
      <body>{children}</body>
    </html>
  );
}
