import { test, expect } from '@playwright/test';
import {
  STORE_A_BASE_URL,
  STORE_B_BASE_URL,
  STOREFRONT_API_URL,
  getCallCounts,
  bumpRevision,
  setRevision,
  updateProductField,
  httpGetStorefrontApi,
  resetFakeCore,
} from './support/fixtures';

test.beforeEach(async () => {
  await resetFakeCore();
});

test.describe('Redis Cache Tenant Isolation & Revision Invalidation', () => {
  test('Warming Store A cache does not bleed into Store B identical request', async ({ page }) => {
    // 1. Warm Store A
    await page.goto(`${STORE_A_BASE_URL}/en`);
    const contentA = await page.content();
    expect(contentA).toContain('Store A');

    // 2. Request identical path for Store B
    await page.goto(`${STORE_B_BASE_URL}/en`);
    const contentB = await page.content();
    expect(contentB).toContain('Store B');
    expect(contentB).not.toContain('Store A');
  });

  test('Bumping Store A revision invalidates Store A cache namespace without affecting Store B', async ({ page }) => {
    // 1. Warm Store A and Store B
    await page.goto(`${STORE_A_BASE_URL}/en/products/product-a`);
    await page.goto(`${STORE_B_BASE_URL}/ar/products/product-b`);

    const countsBefore = await getCallCounts();
    const storeBCallsBefore = countsBefore['/internal/v1/storefront/products/product-b|store-b.localhost'] || 0;

    // 2. Update Product A description in fake Core memory without bumping revision yet
    await updateProductField('store-a.localhost', 'product-a', 'description', 'UPDATED_DESCRIPTION_V11');

    // 3. Bump ONLY Store A revision
    await bumpRevision('store-a.localhost');

    // 4. Request Store A -> gets new Store A content under new revision
    await page.goto(`${STORE_A_BASE_URL}/en/products/product-a`);
    const textA = await page.textContent('body');
    expect(textA).toContain('UPDATED_DESCRIPTION_V11');

    // 5. Request Store B -> gets correct Store B content, NO Store A content, and Store B call count DOES NOT INCREASE
    await page.goto(`${STORE_B_BASE_URL}/ar/products/product-b`);
    const textB = await page.textContent('body');
    expect(textB).toContain('Product B');
    expect(textB).not.toContain('UPDATED_DESCRIPTION_V11');
    expect(textB).not.toContain('Store A');

    const countsAfter = await getCallCounts();
    const storeBCallsAfter = countsAfter['/internal/v1/storefront/products/product-b|store-b.localhost'] || 0;
    expect(storeBCallsAfter).toBe(storeBCallsBefore);
  });

  test('Deterministic call-count proof: Cold request fetches payload from Core, Warm request hits Seller Redis cache', async () => {
    // Reset counts and set a unique revision to guarantee a cold cache lookup on every test run
    await resetFakeCore();
    const uniqueRev = (Date.now() % 100000) + 1000;
    await setRevision('store-a.localhost', uniqueRev);

    // 1. Cold call
    const res1 = await httpGetStorefrontApi('/v1/storefront/store', 'store-a.localhost');
    expect(res1.status).toBe(200);

    const countsCold = await getCallCounts();
    const payloadCallsCold = countsCold['/internal/v1/storefront/store|store-a.localhost'] || 0;
    expect(payloadCallsCold).toBeGreaterThanOrEqual(1);

    // 2. Warm call (identical)
    const res2 = await httpGetStorefrontApi('/v1/storefront/store', 'store-a.localhost');
    expect(res2.status).toBe(200);

    const countsWarm = await getCallCounts();
    const payloadCallsWarm = countsWarm['/internal/v1/storefront/store|store-a.localhost'] || 0;

    // Payload call count to Core MUST remain the same (hit from Seller Redis cache)!
    expect(payloadCallsWarm).toBe(payloadCallsCold);
  });
});
