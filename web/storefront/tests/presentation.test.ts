import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { StoreBootstrap } from '../src/lib/contracts';
import { HOST_A, HOST_B, categoriesA, categoriesB, storeA, storeB } from './fixtures/storefront';

/**
 * Presentation tests.
 *
 * These exercise the layer between the request and the theme: which locales a store
 * publishes, which locale a bare `/` resolves to, and how an unresolvable store or an
 * unsupported theme becomes the customer-facing unavailable state.
 *
 * A real HTTP server stands in for storefront-api and answers by `Host`, so a request for
 * one tenant provably cannot receive another tenant's payload. `next/headers` is mocked
 * because it is the request-scoped API the tenant is read from.
 */

let server: Server;
let currentHostHeader = HOST_A;
let requestLog: { host: string | undefined; url: string }[] = [];

/** Stores keyed by the host they answer for. An unknown host is a 404. */
const stores: Record<string, { store: StoreBootstrap; categories: typeof categoriesA }> = {
  [HOST_A]: { store: storeA, categories: categoriesA },
  [HOST_B]: { store: storeB, categories: categoriesB }
};

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ host: currentHostHeader })
}));

async function loadModule() {
  // Imported after the environment is set, because the client reads its base URL when the
  // module is first evaluated.
  vi.resetModules();
  return import('../src/server/presentation');
}

beforeAll(async () => {
  server = createServer((request, response) => {
    const host = request.headers.host?.split(':')[0];
    requestLog.push({ host, url: request.url ?? '' });

    const tenant = host ? stores[host] : undefined;
    if (!tenant) {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { code: 'storefront_unavailable', message: 'storefront not available' } }));
      return;
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    if ((request.url ?? '').startsWith('/v1/storefront/categories')) {
      response.end(JSON.stringify({ items: tenant.categories }));
      return;
    }
    response.end(JSON.stringify({ store: tenant.store }));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  vi.stubEnv('STOREFRONT_API_BASE_URL', `http://127.0.0.1:${address.port}`);
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  requestLog = [];
  currentHostHeader = HOST_A;
});

afterEach(() => {
  vi.resetModules();
});

describe('locale resolution', () => {
  it('serves the locales the store publishes, its default first', async () => {
    const { localesFor, defaultLocaleFor } = await loadModule();

    expect(localesFor(storeA)).toEqual(['ar', 'en']);
    expect(defaultLocaleFor(storeA)).toBe('ar');

    expect(localesFor(storeB)).toEqual(['en', 'ar']);
    expect(defaultLocaleFor(storeB)).toBe('en');
  });

  it('ignores a market locale this build has no dictionary for', async () => {
    const { localesFor } = await loadModule();

    expect(localesFor({ ...storeA, default_locale: 'fr', supported_locales: ['fr', 'en'] })).toEqual(['en']);
  });

  it('falls back to the platform locales when the store publishes none this build serves', async () => {
    const { localesFor, defaultLocaleFor } = await loadModule();
    const store = { ...storeA, default_locale: 'fr', supported_locales: ['fr', 'de'] };

    expect(localesFor(store)).toEqual(['ar', 'en']);
    expect(defaultLocaleFor(store)).toBe('ar');
  });

  it('tolerates a payload with no locale list at all', async () => {
    const { localesFor } = await loadModule();

    expect(localesFor({ ...storeA, default_locale: '', supported_locales: undefined as never })).toEqual([
      'ar',
      'en'
    ]);
  });
});

describe('presentation loading', () => {
  it('resolves the store, its categories and its theme', async () => {
    const { loadPresentation } = await loadModule();

    const presentation = await loadPresentation('ar');

    expect(presentation.host).toBe(HOST_A);
    expect(presentation.locale).toBe('ar');
    expect(presentation.store.store_code).toBe('store-a');
    expect(presentation.categories).toHaveLength(3);
    expect(presentation.theme.key).toBe('matjero-default');
    expect(presentation.settings.tokens.colorPrimary).toBe('#0f766e');
    expect(presentation.context.branding.name).toBe('Store A');
  });

  it('forwards the tenant host to the service', async () => {
    const { loadPresentation } = await loadModule();

    await loadPresentation('en');

    expect(requestLog.length).toBeGreaterThan(0);
    for (const entry of requestLog) {
      expect(entry.host).toBe(HOST_A);
    }
  });

  it('reports an unresolvable store as unavailable', async () => {
    currentHostHeader = 'not-a-store.example';
    const { loadPresentation, isStoreUnavailable } = await loadModule();

    const error = await loadPresentation('en').catch((thrown: unknown) => thrown);

    expect(isStoreUnavailable(error)).toBe(true);
    expect(error).toMatchObject({ reason: 'store_unresolved' });
  });

  it('rejects a locale segment that is not a supported locale', async () => {
    const { loadPresentation, isStoreUnavailable } = await loadModule();

    const error = await loadPresentation('fr').catch((thrown: unknown) => thrown);

    expect(isStoreUnavailable(error)).toBe(true);
    // No request is made for an unsupported locale.
    expect(requestLog).toHaveLength(0);
  });

  it('rejects a locale the store does not publish', async () => {
    const original = stores[HOST_A].store;
    stores[HOST_A] = {
      ...stores[HOST_A],
      store: { ...original, default_locale: 'en', supported_locales: ['en'] }
    };

    try {
      const { loadPresentation, isStoreUnavailable } = await loadModule();
      const error = await loadPresentation('ar').catch((thrown: unknown) => thrown);

      expect(isStoreUnavailable(error)).toBe(true);
      expect(error).toMatchObject({ reason: 'store_unresolved' });
    } finally {
      stores[HOST_A] = { ...stores[HOST_A], store: original };
    }
  });

  it('refuses to render a store pinned to an unsupported theme', async () => {
    const original = stores[HOST_A].store;
    stores[HOST_A] = {
      ...stores[HOST_A],
      store: { ...original, theme: { key: 'seller-supplied-theme', version: '3.0.0', configuration: {}, configuration_revision: 1 } }
    };

    try {
      const { loadPresentation, isStoreUnavailable } = await loadModule();
      const error = await loadPresentation('ar').catch((thrown: unknown) => thrown);

      expect(isStoreUnavailable(error)).toBe(true);
      expect(error).toMatchObject({ reason: 'theme_unsupported' });
    } finally {
      stores[HOST_A] = { ...stores[HOST_A], store: original };
    }
  });

  it('refuses an incompatible version of a known theme', async () => {
    const original = stores[HOST_A].store;
    stores[HOST_A] = {
      ...stores[HOST_A],
      store: { ...original, theme: { key: 'matjero-default', version: '4.2.0', configuration: {}, configuration_revision: 1 } }
    };

    try {
      const { loadPresentation } = await loadModule();
      await expect(loadPresentation('ar')).rejects.toMatchObject({ reason: 'theme_unsupported' });
    } finally {
      stores[HOST_A] = { ...stores[HOST_A], store: original };
    }
  });

  it('renders a store with no theme installation using the platform default', async () => {
    const original = stores[HOST_A].store;
    stores[HOST_A] = { ...stores[HOST_A], store: { ...original, theme: null } };

    try {
      const { loadPresentation } = await loadModule();
      const presentation = await loadPresentation('ar');

      expect(presentation.theme.key).toBe('matjero-default');
      expect(presentation.settings.revision).toBe(0);
      expect(presentation.settings.announcement).toBeNull();
      expect(presentation.settings.tokens.colorPrimary).toBe('#0f766e');
    } finally {
      stores[HOST_A] = { ...stores[HOST_A], store: original };
    }
  });
});

describe('tenant isolation', () => {
  it('resolves each host to its own store, theme and categories', async () => {
    const { loadPresentation } = await loadModule();

    currentHostHeader = HOST_A;
    const first = await loadPresentation('en');

    vi.resetModules();
    currentHostHeader = HOST_B;
    const { loadPresentation: loadAgain } = await loadModule();
    const second = await loadAgain('en');

    expect(first.store.store_code).toBe('store-a');
    expect(first.context.currency.code).toBe('EGP');
    expect(first.settings.tokens.colorPrimary).toBe('#0f766e');
    expect(first.categories.map((category) => category.slug)).toContain('lighting');

    expect(second.store.store_code).toBe('store-b');
    expect(second.context.currency.code).toBe('SAR');
    expect(second.settings.tokens.colorPrimary).toBe('#7c3aed');
    expect(second.categories.map((category) => category.slug)).toEqual(['outdoor']);

    // Neither store saw the other's categories.
    expect(first.categories.map((category) => category.slug)).not.toContain('outdoor');
    expect(second.categories.map((category) => category.slug)).not.toContain('lighting');
  });

  it('sends every request for a tenant under that tenant host', async () => {
    currentHostHeader = HOST_B;
    const { loadPresentation } = await loadModule();

    await loadPresentation('en');

    expect(requestLog.length).toBeGreaterThan(0);
    expect(requestLog.every((entry) => entry.host === HOST_B)).toBe(true);
    expect(requestLog.some((entry) => entry.host === HOST_A)).toBe(false);
  });

  it('holds no tenant state at module scope', async () => {
    // One module instance, two hosts, no reset in between: if the client or the loader
    // kept the first tenant anywhere at module scope, the second would inherit it.
    const { loadPresentation } = await loadModule();

    currentHostHeader = HOST_A;
    const first = await loadPresentation('en');

    currentHostHeader = HOST_B;
    const second = await loadPresentation('ar');

    expect(first.store.store_code).toBe('store-a');
    expect(second.store.store_code).toBe('store-b');
    expect(second.context.currency.code).toBe('SAR');
  });
});
