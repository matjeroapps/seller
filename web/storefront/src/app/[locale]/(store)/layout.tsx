import { notFound } from 'next/navigation';

import { isStoreUnavailable, loadPresentation } from '../../../server/presentation';

/**
 * The store scope.
 *
 * Tenant resolution happens here, once per request, above every catalog page. The
 * store bootstrap it loads is memoized for the request, so the header, the footer and
 * the page body share a single call.
 *
 * A store that does not resolve publicly — an unregistered domain, a suspended store,
 * a locale its market does not publish, a theme this build cannot render — calls
 * `notFound()`. That is handled by the not-found boundary one level up, outside this
 * layout, so the customer sees the standalone unavailable page instead of store chrome
 * wrapped around an error.
 */

export default async function StoreLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  let presentation;
  try {
    presentation = await loadPresentation(locale);
  } catch (error) {
    if (isStoreUnavailable(error)) {
      notFound();
    }
    // A transport failure is not a missing store. It propagates to the error
    // boundary, which offers a retry instead of claiming the store does not exist.
    throw error;
  }

  const { Layout } = presentation.theme.components;
  return <Layout context={presentation.context}>{children}</Layout>;
}
