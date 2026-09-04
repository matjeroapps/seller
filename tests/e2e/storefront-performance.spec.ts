import { test, expect } from '@playwright/test';
import {
  STORE_A_BASE_URL,
  PERF_REVISION_HOME,
  PERF_REVISION_CATALOG,
  PERF_REVISION_PRODUCT,
  PERF_REVISION_SEARCH,
  PERF_REVISION_SITEMAP,
  setRevision,
  resetCallCounts,
  getCallCounts,
  resetFakeCore,
} from './support/fixtures';

test.beforeEach(async () => {
  await resetFakeCore();
});

function summarizeCalls(calls: Record<string, number>, host: string) {
  let revProbes = 0;
  let payloadCalls = 0;
  const observedEndpoints: string[] = [];

  for (const [key, count] of Object.entries(calls)) {
    if (!key.endsWith(`|${host}`)) continue;
    const path = key.split('|')[0];
    if (path === '/internal/v1/storefront/revision') {
      revProbes += count;
    } else {
      payloadCalls += count;
      observedEndpoints.push(path);
    }
  }

  return { revProbes, payloadCalls, observedEndpoints };
}

test.describe('Storefront Measured Performance & Cache Call Counts', () => {
  test('Home route call counts: Cold vs Warm Redis cache', async ({ request }) => {
    const host = 'store-a.localhost';
    await setRevision(host, PERF_REVISION_HOME);

    // 1. Cold Request
    await resetCallCounts();
    const resCold = await request.get(`${STORE_A_BASE_URL}/en`);
    expect(resCold.status()).toBe(200);

    const coldCalls = await getCallCounts();
    const coldSummary = summarizeCalls(coldCalls, host);

    expect(coldSummary.revProbes).toBeGreaterThanOrEqual(1);
    expect(coldSummary.payloadCalls).toBeGreaterThanOrEqual(1);

    // 2. Warm Request
    await resetCallCounts();
    const resWarm = await request.get(`${STORE_A_BASE_URL}/en`);
    expect(resWarm.status()).toBe(200);

    const warmCalls = await getCallCounts();
    const warmSummary = summarizeCalls(warmCalls, host);

    expect(warmSummary.revProbes).toBeGreaterThanOrEqual(1);
    expect(warmSummary.payloadCalls).toBe(0);
  });

  test('Catalog route call counts: Cold vs Warm Redis cache', async ({ request }) => {
    const host = 'store-a.localhost';
    await setRevision(host, PERF_REVISION_CATALOG);

    // 1. Cold Request
    await resetCallCounts();
    const resCold = await request.get(`${STORE_A_BASE_URL}/en/products`);
    expect(resCold.status()).toBe(200);

    const coldCalls = await getCallCounts();
    const coldSummary = summarizeCalls(coldCalls, host);

    expect(coldSummary.revProbes).toBeGreaterThanOrEqual(1);
    expect(coldSummary.payloadCalls).toBeGreaterThanOrEqual(1);

    // 2. Warm Request
    await resetCallCounts();
    const resWarm = await request.get(`${STORE_A_BASE_URL}/en/products`);
    expect(resWarm.status()).toBe(200);

    const warmCalls = await getCallCounts();
    const warmSummary = summarizeCalls(warmCalls, host);

    expect(warmSummary.revProbes).toBeGreaterThanOrEqual(1);
    expect(warmSummary.payloadCalls).toBe(0);
  });

  test('Product detail route call counts: Cold vs Warm Redis cache', async ({ request }) => {
    const host = 'store-a.localhost';
    await setRevision(host, PERF_REVISION_PRODUCT);

    // 1. Cold Request
    await resetCallCounts();
    const resCold = await request.get(`${STORE_A_BASE_URL}/en/products/product-a`);
    expect(resCold.status()).toBe(200);

    const coldCalls = await getCallCounts();
    const coldSummary = summarizeCalls(coldCalls, host);

    expect(coldSummary.revProbes).toBeGreaterThanOrEqual(1);
    expect(coldSummary.payloadCalls).toBeGreaterThanOrEqual(1);

    // 2. Warm Request
    await resetCallCounts();
    const resWarm = await request.get(`${STORE_A_BASE_URL}/en/products/product-a`);
    expect(resWarm.status()).toBe(200);

    const warmCalls = await getCallCounts();
    const warmSummary = summarizeCalls(warmCalls, host);

    expect(warmSummary.revProbes).toBeGreaterThanOrEqual(1);
    expect(warmSummary.payloadCalls).toBe(0);
  });

  test('Search route call counts: Cold vs Warm Redis cache', async ({ request }) => {
    const host = 'store-a.localhost';
    await setRevision(host, PERF_REVISION_SEARCH);

    // 1. Cold Request
    await resetCallCounts();
    const resCold = await request.get(`${STORE_A_BASE_URL}/en/search?q=Product`);
    expect(resCold.status()).toBe(200);

    const coldCalls = await getCallCounts();
    const coldSummary = summarizeCalls(coldCalls, host);

    expect(coldSummary.revProbes).toBeGreaterThanOrEqual(1);
    expect(coldSummary.payloadCalls).toBeGreaterThanOrEqual(1);

    // 2. Warm Request
    await resetCallCounts();
    const resWarm = await request.get(`${STORE_A_BASE_URL}/en/search?q=Product`);
    expect(resWarm.status()).toBe(200);

    const warmCalls = await getCallCounts();
    const warmSummary = summarizeCalls(warmCalls, host);

    expect(warmSummary.revProbes).toBeGreaterThanOrEqual(1);
    expect(warmSummary.payloadCalls).toBe(0);
  });

  test('Sitemap route call counts: Cold vs Warm Redis cache', async ({ request }) => {
    const host = 'store-a.localhost';
    await setRevision(host, PERF_REVISION_SITEMAP);

    // 1. Cold Request
    await resetCallCounts();
    const resCold = await request.get(`${STORE_A_BASE_URL}/sitemap.xml`);
    expect(resCold.status()).toBe(200);

    const coldCalls = await getCallCounts();
    const coldSummary = summarizeCalls(coldCalls, host);

    expect(coldSummary.revProbes).toBeGreaterThanOrEqual(1);
    expect(coldSummary.payloadCalls).toBeGreaterThanOrEqual(1);

    // 2. Warm Request
    await resetCallCounts();
    const resWarm = await request.get(`${STORE_A_BASE_URL}/sitemap.xml`);
    expect(resWarm.status()).toBe(200);

    const warmCalls = await getCallCounts();
    const warmSummary = summarizeCalls(warmCalls, host);

    expect(warmSummary.revProbes).toBeGreaterThanOrEqual(1);
    expect(warmSummary.payloadCalls).toBe(0);
  });
});
