import { loadPresentation, safeDictionary, safeLocale } from '../server/presentation';
import { currentLocale } from '../server/request-path';
import { themeRegistry } from '../themes';

/**
 * The not-found boundary.
 *
 * Two different situations arrive here and they need different answers.
 *
 * A request for a path that matches no route is an ordinary 404 inside a store that is
 * perfectly healthy, and should render the storefront's own 404 page with its chrome
 * intact. A request whose store does not resolve — an unregistered domain, a suspended
 * store, a locale its market does not publish, a theme this build cannot render —
 * arrives here because the store scope called `notFound()`, and must render the
 * standalone unavailable page instead.
 *
 * The two are told apart by resolving the store. That costs no extra request: in the
 * unavailable case the resolution already failed earlier in this same request and is
 * memoized, and in the ordinary-404 case the store is needed anyway to draw the chrome.
 *
 * The unavailable page names no reason. An unknown domain and a suspended store are
 * intentionally indistinguishable, and moderation state is not public information.
 */

export default async function NotFoundBoundary() {
  const locale = safeLocale((await currentLocale()) ?? 'en');

  try {
    const presentation = await loadPresentation(locale);
    const { Layout, NotFound } = presentation.theme.components;
    return (
      <Layout context={presentation.context}>
        <NotFound context={presentation.context} />
      </Layout>
    );
  } catch {
    // Anything that prevents resolving the store lands on the same generic page. A
    // customer cannot act on the difference between an unavailable store and an
    // unreachable one, and this page discloses neither.
    const { Unavailable } = themeRegistry.default().components;
    return <Unavailable locale={locale} copy={safeDictionary(locale)} />;
  }
}
