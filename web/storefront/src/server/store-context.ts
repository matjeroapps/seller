import 'server-only';

import { cache } from 'react';
import { headers } from 'next/headers';

import { createStorefrontClient, type StorefrontClient } from '../lib/api';
import type { StoreBootstrap } from '../lib/contracts';
import type { Locale } from '../i18n/locales';
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
 * scopes memoization to the current server request, keyed on the host, so a page
 * whose layout, header, footer and body all need store context issues one call
 * rather than five — and a different host in a concurrent request gets its own
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

/**
 * loadStore reads the store bootstrap for a host and locale.
 *
 * Memoized on both arguments: the same store rendered in two locales within one
 * request is two distinct payloads, and must not collapse into one.
 */
export const loadStore = cache(
  async (host: string, locale: Locale): Promise<StoreBootstrap> => client.store(host, locale)
);
