import { test, expect } from '@playwright/test';
import {
  STORE_A_BASE_URL,
  getUniqueTestRevision,
  setRevision,
  resetCallCounts,
  getCallCounts,
  resetFakeCore,
} from './support/fixtures';

test.beforeEach(async () => {
  await resetFakeCore();
});

function getEndpointCounts(calls: Record<string, number>, host: string) {
  const counts: Record<string, number> = {};
  let revProbes = 0;
  let payloadCalls = 0;

  for (const [key, count] of Object.entries(calls)) {
    if (!key.endsWith(`|${host}`)) continue;
    const path = key.split('|')[0];
    counts[path] = (counts[path] || 0) + count;
    if (path === '/internal/v1/storefront/revision') {
      revProbes += count;
    } else {
      payloadCalls += count;
    }
  }

  return { revProbes, payloadCalls, counts };
}

test.describe('Storefront Measured Performance & Cache Call Counts', () => {
  test('Home route call counts: Cold vs Warm Redis cache', async ({ request }) => {
    const host = 'store-a.localhost';
    await setRevision(host, getUniqueTestRevision());

    // 1. Cold Request
    await resetCallCounts();
    const resCold = await request.get(`${STORE_A_BASE_URL}/en`);
    expect(resCold.status()).toBe(200);

    const coldCalls = await getCallCounts();
    const coldSummary = getEndpointCounts(coldCalls, host);

    // Structural invariant: Each cacheable resource request issues 1 revision probe before checking cache
    expect(coldSummary.payloadCalls).toBe(3);
    expect(coldSummary.revProbes).toBe(3);
    expect(coldSummary.revProbes).toBe(coldSummary.payloadCalls);

    // Exact endpoint breakdown
    expect(coldSummary.counts['/internal/v1/storefront/revision']).toBe(3);
    expect(coldSummary.counts['/internal/v1/storefront/store']).toBe(1);
    expect(coldSummary.counts['/internal/v1/storefront/categories']).toBe(1);
    expect(coldSummary.counts['/internal/v1/storefront/products']).toBe(1);

    // 2. Warm Request
    await resetCallCounts();
    const resWarm = await request.get(`${STORE_A_BASE_URL}/en`);
    expect(resWarm.status()).toBe(200);

    const warmCalls = await getCallCounts();
    const warmSummary = getEndpointCounts(warmCalls, host);

    // Warm Redis caching eliminates payload reads to Core, but revision probes intentionally remain
    expect(warmSummary.payloadCalls).toBe(0);
    expect(warmSummary.revProbes).toBe(3);
    expect(warmSummary.revProbes).toBe(coldSummary.revProbes);
    expect(warmSummary.counts['/internal/v1/storefront/revision']).toBe(3);
  });

  test('Catalog route call counts: Cold vs Warm Redis cache', async ({ request }) => {
    const host = 'store-a.localhost';
    await setRevision(host, getUniqueTestRevision());

    // 1. Cold Request
    await resetCallCounts();
    const resCold = await request.get(`${STORE_A_BASE_URL}/en/products`);
    expect(resCold.status()).toBe(200);

    const coldCalls = await getCallCounts();
    const coldSummary = getEndpointCounts(coldCalls, host);

    expect(coldSummary.payloadCalls).toBe(3);
    expect(coldSummary.revProbes).toBe(3);
    expect(coldSummary.revProbes).toBe(coldSummary.payloadCalls);

    expect(coldSummary.counts['/internal/v1/storefront/revision']).toBe(3);
    expect(coldSummary.counts['/internal/v1/storefront/store']).toBe(1);
    expect(coldSummary.counts['/internal/v1/storefront/categories']).toBe(1);
    expect(coldSummary.counts['/internal/v1/storefront/products']).toBe(1);

    // 2. Warm Request
    await resetCallCounts();
    const resWarm = await request.get(`${STORE_A_BASE_URL}/en/products`);
    expect(resWarm.status()).toBe(200);

    const warmCalls = await getCallCounts();
    const warmSummary = getEndpointCounts(warmCalls, host);

    expect(warmSummary.payloadCalls).toBe(0);
    expect(warmSummary.revProbes).toBe(3);
    expect(warmSummary.revProbes).toBe(coldSummary.revProbes);
    expect(warmSummary.counts['/internal/v1/storefront/revision']).toBe(3);
  });

  test('Product detail route call counts: Cold vs Warm Redis cache', async ({ request }) => {
    const host = 'store-a.localhost';
    await setRevision(host, getUniqueTestRevision());

    // 1. Cold Request
    await resetCallCounts();
    const resCold = await request.get(`${STORE_A_BASE_URL}/en/products/product-a`);
    expect(resCold.status()).toBe(200);

    const coldCalls = await getCallCounts();
    const coldSummary = getEndpointCounts(coldCalls, host);

    // Next.js App Router executes generateMetadata + Page component independently on cold render,
    // resulting in 2 product detail fetches + 1 store fetch + 1 categories fetch = 4 payload calls and 4 revision probes.
    expect(coldSummary.payloadCalls).toBe(4);
    expect(coldSummary.revProbes).toBe(4);
    expect(coldSummary.revProbes).toBe(coldSummary.payloadCalls);

    expect(coldSummary.counts['/internal/v1/storefront/revision']).toBe(4);
    expect(coldSummary.counts['/internal/v1/storefront/store']).toBe(1);
    expect(coldSummary.counts['/internal/v1/storefront/categories']).toBe(1);
    expect(coldSummary.counts['/internal/v1/storefront/products/product-a']).toBe(2);

    // 2. Warm Request
    await resetCallCounts();
    const resWarm = await request.get(`${STORE_A_BASE_URL}/en/products/product-a`);
    expect(resWarm.status()).toBe(200);

    const warmCalls = await getCallCounts();
    const warmSummary = getEndpointCounts(warmCalls, host);

    expect(warmSummary.payloadCalls).toBe(0);
    expect(warmSummary.revProbes).toBe(4);
    expect(warmSummary.revProbes).toBe(coldSummary.revProbes);
    expect(warmSummary.counts['/internal/v1/storefront/revision']).toBe(4);
  });

  test('Search route call counts: Cold vs Warm Redis cache', async ({ request }) => {
    const host = 'store-a.localhost';
    await setRevision(host, getUniqueTestRevision());

    // 1. Cold Request
    await resetCallCounts();
    const resCold = await request.get(`${STORE_A_BASE_URL}/en/search?q=Product`);
    expect(resCold.status()).toBe(200);

    const coldCalls = await getCallCounts();
    const coldSummary = getEndpointCounts(coldCalls, host);

    expect(coldSummary.payloadCalls).toBe(3);
    expect(coldSummary.revProbes).toBe(3);
    expect(coldSummary.revProbes).toBe(coldSummary.payloadCalls);

    expect(coldSummary.counts['/internal/v1/storefront/revision']).toBe(3);
    expect(coldSummary.counts['/internal/v1/storefront/store']).toBe(1);
    expect(coldSummary.counts['/internal/v1/storefront/categories']).toBe(1);
    expect(coldSummary.counts['/internal/v1/storefront/search']).toBe(1);

    // 2. Warm Request
    await resetCallCounts();
    const resWarm = await request.get(`${STORE_A_BASE_URL}/en/search?q=Product`);
    expect(resWarm.status()).toBe(200);

    const warmCalls = await getCallCounts();
    const warmSummary = getEndpointCounts(warmCalls, host);

    expect(warmSummary.payloadCalls).toBe(0);
    expect(warmSummary.revProbes).toBe(3);
    expect(warmSummary.revProbes).toBe(coldSummary.revProbes);
    expect(warmSummary.counts['/internal/v1/storefront/revision']).toBe(3);
  });

  test('Sitemap route call counts: Cold vs Warm Redis cache', async ({ request }) => {
    const host = 'store-a.localhost';
    await setRevision(host, getUniqueTestRevision());

    // 1. Cold Request
    await resetCallCounts();
    const resCold = await request.get(`${STORE_A_BASE_URL}/sitemap.xml`);
    expect(resCold.status()).toBe(200);

    const coldCalls = await getCallCounts();
    const coldSummary = getEndpointCounts(coldCalls, host);

    // Sitemap iterates supported locales (en, ar) -> fetches store (1), categories (2), products (2) = 5 payload calls
    expect(coldSummary.payloadCalls).toBe(5);
    expect(coldSummary.revProbes).toBe(5);
    expect(coldSummary.revProbes).toBe(coldSummary.payloadCalls);

    expect(coldSummary.counts['/internal/v1/storefront/revision']).toBe(5);
    expect(coldSummary.counts['/internal/v1/storefront/store']).toBe(1);
    expect(coldSummary.counts['/internal/v1/storefront/categories']).toBe(2);
    expect(coldSummary.counts['/internal/v1/storefront/products']).toBe(2);

    // 2. Warm Request
    await resetCallCounts();
    const resWarm = await request.get(`${STORE_A_BASE_URL}/sitemap.xml`);
    expect(resWarm.status()).toBe(200);

    const warmCalls = await getCallCounts();
    const warmSummary = getEndpointCounts(warmCalls, host);

    expect(warmSummary.payloadCalls).toBe(0);
    expect(warmSummary.revProbes).toBe(5);
    expect(warmSummary.revProbes).toBe(coldSummary.revProbes);
    expect(warmSummary.counts['/internal/v1/storefront/revision']).toBe(5);
  });
});
