import 'server-only';

import { cache } from 'react';
import { headers } from 'next/headers';

import { createStorefrontClient, type StorefrontClient } from '../lib/api';
import type { StoreBootstrap } from '../lib/contracts';
import type { Locale } from '../i18n/locales';
import { PREVIEW_INVALID_HEADER, PREVIEW_TOKEN_HEADER } from '../lib/headers';
import { runtimeConfig } from './config';
import { resolveTenantHost } from './tenant';

/**
 * Per-request store context.
 *
 * Two rules govern this module.
 *
 * First, no tenant state is held at module scope. The client itself is stateless
 * and every read takes the host explicitly, so one Next.js process serving many
 * stores cannot leak one store's data into another store's render.
 *
 * Second, the bootstrap payload is fetched once per request. `cache` from React
 * scopes memoization to the current server request, keyed on the host and preview token,
 * so a page whose layout, header, footer and body all need store context issues one call
 * rather than five — and a different host or preview token in a concurrent request gets its own
 * entry rather than sharing one.
 */

/** The shared client. It carries no tenant state; the host is a per-call argument. */
const client: StorefrontClient = createStorefrontClient();

export function storefrontClient(): StorefrontClient {
  return client;
}

/** The trusted customer host of the current request. */
export const currentHost = cache(async (): Promise<string> => {
  return resolveTenantHost(await headers(), runtimeConfig());
});

/** The draft theme preview token for the current request, if present. */
export const currentPreviewToken = cache(async (): Promise<string | undefined> => {
  try {
    const token = (await headers()).get(PREVIEW_TOKEN_HEADER);
    return token && token.length > 0 ? token : undefined;
  } catch {
    return undefined;
  }
});

/** Reports whether an invalid or duplicate preview token was supplied on the request. */
export const isPreviewInvalid = cache(async (): Promise<boolean> => {
  try {
    return (await headers()).has(PREVIEW_INVALID_HEADER);
  } catch {
    return false;
  }
});

/**
 * loadStore reads the store bootstrap for a host, locale, and optional preview token.
 *
 * Memoized on all arguments: the same store rendered with or without a preview token
 * within one request produces distinct payloads.
 */
export const loadStore = cache(
  async (host: string, locale: Locale, previewToken?: string): Promise<StoreBootstrap> =>
    client.store(host, locale, previewToken)
);
