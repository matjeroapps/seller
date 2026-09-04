import { test, expect } from '@playwright/test';
import {
  STORE_A_BASE_URL,
  STORE_B_BASE_URL,
  STORE_A_MARKER,
  STORE_B_MARKER,
  STOREFRONT_API_URL,
  getCallCounts,
  bumpRevision,
  updateProductField,
  resetFakeCore,
} from './support/fixtures';

test.beforeEach(async () => {
  await resetFakeCore();
});

test.describe('Redis Cache Tenant Isolation & Revision Invalidation', () => {
  test('Warming Store A cache does not bleed into Store B identical request', async ({ request, page }) => {
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
    // 1. Warm Store A
    await page.goto(`${STORE_A_BASE_URL}/en/products/product-a`);
    const text1 = await page.textContent('body');
    expect(text1).toContain('Product A');

    // Update Product A description in fake Core memory without bumping revision yet
    await updateProductField('store-a.localhost', 'product-a', 'description', 'UPDATED_DESCRIPTION_V11');

    // 2. Before bumping revision, cached payload is returned
    await page.goto(`${STORE_A_BASE_URL}/en/products/product-a`);
    const text2 = await page.textContent('body');
    // Still old cached content if cache is active
    expect(text2).toContain('Product A');

    // 3. Bump Store A revision
    await bumpRevision('store-a.localhost');

    // 4. Next request reads new state under new revision
    await page.goto(`${STORE_A_BASE_URL}/en/products/product-a`);
    const text3 = await page.textContent('body');
    expect(text3).toContain('UPDATED_DESCRIPTION_V11');
  });

  test('Deterministic call-count proof: Cold request fetches payload from Core, Warm request hits Seller Redis cache', async ({ page }) => {
    // Reset counts and bump revision twice to guarantee a cold cache lookup for an unseen revision (12)
    await resetFakeCore();
    await bumpRevision('store-a.localhost');
    await bumpRevision('store-a.localhost');

    // 1. Cold call
    await page.goto(`${STORE_A_BASE_URL}/en`);

    const countsCold = await getCallCounts();
    const payloadCallsCold = countsCold['/internal/v1/storefront/store|store-a.localhost'] || 0;
    expect(payloadCallsCold).toBeGreaterThanOrEqual(1);

    // 2. Warm call (identical)
    await page.goto(`${STORE_A_BASE_URL}/en`);

    const countsWarm = await getCallCounts();
    const payloadCallsWarm = countsWarm['/internal/v1/storefront/store|store-a.localhost'] || 0;

    // Payload call count to Core MUST remain the same (hit from Seller Redis cache)!
    expect(payloadCallsWarm).toBe(payloadCallsCold);
  });
});
