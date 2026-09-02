import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';

import { createStorefrontClient, isStorefrontApiError, StorefrontApiError } from '../src/lib/api';
import { HOST_A, categoriesA, productDetailA, productPageA, storeA } from './fixtures/storefront';

/**
 * API client tests.
 *
 * They run against a real HTTP server rather than a mocked `fetch`, because the point
 * of this client is what it puts on the wire: the tenant travels in the `Host` header,
 * and a mock would not prove that.
 */

type Recorded = {
  method: string;
  url: string;
  host: string | undefined;
  acceptLanguage: string | undefined;
};

let server: Server;
let baseUrl: string;
let requests: Recorded[];
let respond: (recorded: Recorded) => { status: number; body: string };

beforeEach(async () => {
  requests = [];
  respond = () => ({ status: 200, body: '{}' });

  server = createServer((request, response) => {
    const recorded: Recorded = {
      method: request.method ?? '',
      url: request.url ?? '',
      host: request.headers.host,
      acceptLanguage: request.headers['accept-language'] as string | undefined
    };
    requests.push(recorded);

    const { status, body } = respond(recorded);
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(body);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function client(overrides: Partial<Parameters<typeof createStorefrontClient>[0]> = {}) {
  return createStorefrontClient({
    apiBaseUrl: baseUrl,
    trustForwardedHost: false,
    requestTimeoutMs: 2_000,
    fallbackHost: '',
    ...overrides
  });
}

describe('storefront api client', () => {
  it('sends the tenant as the Host header', async () => {
    respond = () => ({ status: 200, body: JSON.stringify({ store: storeA }) });

    const store = await client().store(HOST_A, 'ar');

    expect(store.store_code).toBe('store-a');
    expect(requests).toHaveLength(1);
    expect(requests[0].host).toBe(HOST_A);
  });

  it('forwards the locale explicitly and as Accept-Language', async () => {
    respond = () => ({ status: 200, body: JSON.stringify({ store: storeA }) });

    await client().store(HOST_A, 'ar');

    expect(requests[0].url).toBe('/v1/storefront/store?locale=ar');
    expect(requests[0].acceptLanguage).toBe('ar');
  });

  it('reads every public route', async () => {
    respond = (recorded) => {
      if (recorded.url.startsWith('/v1/storefront/store')) {
        return { status: 200, body: JSON.stringify({ store: storeA }) };
      }
      if (recorded.url.startsWith('/v1/storefront/categories/')) {
        return { status: 200, body: JSON.stringify({ category: categoriesA[0] }) };
      }
      if (recorded.url.startsWith('/v1/storefront/categories')) {
        return { status: 200, body: JSON.stringify({ items: categoriesA }) };
      }
      if (recorded.url.startsWith('/v1/storefront/products/')) {
        return { status: 200, body: JSON.stringify({ product: productDetailA }) };
      }
      return { status: 200, body: JSON.stringify(productPageA) };
    };

    const api = client();
    expect((await api.store(HOST_A, 'en')).store_code).toBe('store-a');
    expect(await api.categories(HOST_A, 'en')).toHaveLength(3);
    expect((await api.category(HOST_A, 'en', 'lighting')).slug).toBe('lighting');
    expect((await api.products(HOST_A, 'en')).items).toHaveLength(2);
    expect((await api.product(HOST_A, 'en', 'aurora-desk-lamp')).slug).toBe('aurora-desk-lamp');
    expect((await api.search(HOST_A, 'en', { keyword: 'lamp' })).items).toHaveLength(2);

    expect(requests.map((request) => request.url)).toEqual([
      '/v1/storefront/store?locale=en',
      '/v1/storefront/categories?locale=en',
      '/v1/storefront/categories/lighting?locale=en',
      '/v1/storefront/products?locale=en',
      '/v1/storefront/products/aurora-desk-lamp?locale=en',
      '/v1/storefront/search?locale=en&q=lamp'
    ]);
  });

  it('percent-encodes a slug rather than letting it alter the path', async () => {
    respond = () => ({ status: 200, body: JSON.stringify({ product: productDetailA }) });

    await client().product(HOST_A, 'en', '../../internal/v1/stores');

    expect(requests[0].url).toBe('/v1/storefront/products/..%2F..%2Finternal%2Fv1%2Fstores?locale=en');
  });

  it('encodes query values so a keyword cannot inject a parameter', async () => {
    respond = () => ({ status: 200, body: JSON.stringify(productPageA) });

    await client().search(HOST_A, 'en', { keyword: 'lamp&limit=999&sort=evil' });

    expect(requests[0].url).toBe('/v1/storefront/search?locale=en&q=lamp%26limit%3D999%26sort%3Devil');
  });

  it('serializes only the catalog parameters that were supplied', async () => {
    respond = () => ({ status: 200, body: JSON.stringify(productPageA) });

    await client().products(HOST_A, 'ar', {
      category: 'lighting',
      availability: 'in_stock',
      sort: 'price_asc',
      minPriceMinor: 1000,
      maxPriceMinor: 90000,
      limit: 12,
      offset: 24
    });

    const query = new URLSearchParams(requests[0].url.split('?')[1]);
    expect(Object.fromEntries(query)).toEqual({
      locale: 'ar',
      category: 'lighting',
      availability: 'in_stock',
      sort: 'price_asc',
      min_price: '1000',
      max_price: '90000',
      limit: '12',
      offset: '24'
    });
  });

  it('caps a requested page size at the read model maximum', async () => {
    respond = () => ({ status: 200, body: JSON.stringify(productPageA) });

    await client().products(HOST_A, 'en', { limit: 5_000 });

    expect(new URLSearchParams(requests[0].url.split('?')[1]).get('limit')).toBe('60');
  });

  it('classifies each error status', async () => {
    const cases: [number, string][] = [
      [404, 'not_found'],
      [400, 'invalid_request'],
      [503, 'unavailable'],
      [500, 'unavailable'],
      [418, 'unexpected']
    ];

    for (const [status, kind] of cases) {
      respond = () => ({ status, body: JSON.stringify({ error: { code: 'x', message: 'y' } }) });
      await expect(client().store(HOST_A, 'en')).rejects.toMatchObject({ kind, status });
    }
  });

  it('treats a missing tenant host as an unresolvable store without calling the service', async () => {
    await expect(client().store('', 'en')).rejects.toMatchObject({ kind: 'not_found' });
    expect(requests).toHaveLength(0);
  });

  it('reports unparseable JSON instead of throwing a syntax error mid-render', async () => {
    respond = () => ({ status: 200, body: '{"store": ' });

    const error = await client()
      .store(HOST_A, 'en')
      .catch((thrown: unknown) => thrown);

    expect(isStorefrontApiError(error)).toBe(true);
    expect((error as StorefrontApiError).kind).toBe('unexpected');
  });

  it('reports a well-formed response of the wrong shape', async () => {
    respond = () => ({ status: 200, body: JSON.stringify({ unexpected: true }) });

    await expect(client().store(HOST_A, 'en')).rejects.toMatchObject({ kind: 'unexpected' });
    await expect(client().categories(HOST_A, 'en')).rejects.toMatchObject({ kind: 'unexpected' });
    await expect(client().product(HOST_A, 'en', 'x')).rejects.toMatchObject({ kind: 'unexpected' });
    await expect(client().products(HOST_A, 'en')).rejects.toMatchObject({ kind: 'unexpected' });
  });

  it('substitutes pagination when the envelope omits it', async () => {
    respond = () => ({ status: 200, body: JSON.stringify({ items: productPageA.items }) });

    const page = await client().products(HOST_A, 'en');

    expect(page.items).toHaveLength(2);
    expect(page.pagination).toEqual({ total: 2, limit: 2, offset: 0 });
  });

  it('fails the request rather than buffering an unbounded response', async () => {
    // Just over the 1 MiB ceiling the client enforces.
    respond = () => ({ status: 200, body: `{"pad":"${'x'.repeat(1_100_000)}"}` });

    await expect(client().store(HOST_A, 'en')).rejects.toMatchObject({ kind: 'unexpected' });
  });

  it('surfaces an unreachable service as unavailable', async () => {
    // Port 1 is not listening, so the connection is refused immediately.
    const unreachable = createStorefrontClient({
      apiBaseUrl: 'http://127.0.0.1:1',
      trustForwardedHost: false,
      requestTimeoutMs: 1_000,
      fallbackHost: ''
    });

    await expect(unreachable.store(HOST_A, 'en')).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('bounds a slow service with the configured timeout', async () => {
    server.removeAllListeners('request');
    // Never responds, so only the client-side timeout can end this request.
    server.on('request', () => {});

    await expect(client({ requestTimeoutMs: 120 }).store(HOST_A, 'en')).rejects.toMatchObject({
      kind: 'unavailable'
    });
  });

  it('keeps one tenant out of another tenant response', async () => {
    respond = (recorded) => ({
      status: 200,
      body: JSON.stringify({ store: { ...storeA, store_code: recorded.host ?? 'unknown' } })
    });

    const api = client();
    const [first, second] = await Promise.all([
      api.store('store-a.example', 'en'),
      api.store('store-b.example', 'en')
    ]);

    expect(first.store_code).toBe('store-a.example');
    expect(second.store_code).toBe('store-b.example');
  });
});
