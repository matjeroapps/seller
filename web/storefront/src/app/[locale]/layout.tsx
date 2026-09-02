import { locales, type Locale } from '../../i18n/locales';

/**
 * The locale segment.
 *
 * `generateStaticParams` plus `dynamicParams = false` turn the locale into a routing
 * allowlist: a segment that is not a supported locale never matches, so Next answers it
 * from the not-found route rather than entering a page. That distinction matters, because
 * a 404 the router decides is fully server-rendered, whereas one a page raises mid-render
 * is not (see the rendering report).
 *
 * This layout adds no element of its own. `lang` and `dir` belong on the document, which
 * the root layout owns.
 */

export function generateStaticParams(): { locale: Locale }[] {
  return locales.map((locale) => ({ locale }));
}

export const dynamicParams = false;

export default function LocaleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
