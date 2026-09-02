import { notFound, redirect } from 'next/navigation';

import { isStorefrontApiError } from '../lib/api';
import { previewAwareHref } from '../lib/preview';
import { defaultLocaleFor } from '../server/presentation';
import { currentHost, currentPreviewToken, isPreviewInvalid, loadStore } from '../server/store-context';

/**
 * The bare root.
 *
 * A customer arriving at `/` is sent to the store's own default locale, which is
 * resolved from the store's market rather than hardcoded. A store whose market
 * defaults to Arabic lands on `/ar`, not `/en`.
 *
 * A host that does not resolve to a public store is a 404 here. It is never redirected
 * into a locale, because that would produce a storefront-shaped page for a domain that
 * has no storefront.
 */

export default async function RootPage() {
  if (await isPreviewInvalid()) {
    notFound();
  }

  const host = await currentHost();
  const previewToken = await currentPreviewToken();

  let store;
  try {
    // The default locale is a property of the store, so the store has to be read
    // before a target exists. English is used for this one probe; the payload's
    // locale-independent fields are all this decision needs.
    store = await loadStore(host, 'en', previewToken);
  } catch (error) {
    if (isStorefrontApiError(error) && error.kind === 'not_found') {
      notFound();
    }
    throw error;
  }

  const defaultLocale = defaultLocaleFor(store);
  const targetHref = previewAwareHref(`/${defaultLocale}`, previewToken);
  redirect(targetHref as unknown as Parameters<typeof redirect>[0]);
}
