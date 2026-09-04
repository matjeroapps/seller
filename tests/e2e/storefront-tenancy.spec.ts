import { test, expect } from '@playwright/test';
import {
  STORE_A_BASE_URL,
  STORE_B_BASE_URL,
  STORE_A_MARKER,
  STORE_B_MARKER,
  resetFakeCore,
} from './support/fixtures';

test.beforeEach(async () => {
  await resetFakeCore();
});

test.describe('Storefront Multi-Tenant Isolation', () => {
  test('Store A -> Store B -> Store A sequence isolation', async ({ page }) => {
    // 1. Visit Store A
    await page.goto(`${STORE_A_BASE_URL}/en`);
    await expect(page).toHaveURL(`${STORE_A_BASE_URL}/en`);
    const contentA1 = await page.content();
    expect(contentA1).toContain('Store A');
    expect(contentA1).toContain(STORE_A_MARKER);
    expect(contentA1).not.toContain('Store B');
    expect(contentA1).not.toContain(STORE_B_MARKER);

    // 2. Visit Store B
    await page.goto(`${STORE_B_BASE_URL}/ar`);
    await expect(page).toHaveURL(`${STORE_B_BASE_URL}/ar`);
    const contentB = await page.content();
    expect(contentB).toContain('Store B');
    expect(contentB).toContain(STORE_B_MARKER);
    expect(contentB).not.toContain('Store A');
    expect(contentB).not.toContain(STORE_A_MARKER);

    // 3. Visit Store A again
    await page.goto(`${STORE_A_BASE_URL}/en`);
    await expect(page).toHaveURL(`${STORE_A_BASE_URL}/en`);
    const contentA2 = await page.content();
    expect(contentA2).toContain('Store A');
    expect(contentA2).toContain(STORE_A_MARKER);
    expect(contentA2).not.toContain('Store B');
    expect(contentA2).not.toContain(STORE_B_MARKER);
  });

  test('Store B -> Store A -> Store B sequence isolation', async ({ page }) => {
    // 1. Visit Store B
    await page.goto(`${STORE_B_BASE_URL}/ar`);
    const contentB1 = await page.content();
    expect(contentB1).toContain('Store B');
    expect(contentB1).toContain(STORE_B_MARKER);

    // 2. Visit Store A
    await page.goto(`${STORE_A_BASE_URL}/en`);
    const contentA = await page.content();
    expect(contentA).toContain('Store A');
    expect(contentA).toContain(STORE_A_MARKER);

    // 3. Visit Store B again
    await page.goto(`${STORE_B_BASE_URL}/ar`);
    const contentB2 = await page.content();
    expect(contentB2).toContain('Store B');
    expect(contentB2).toContain(STORE_B_MARKER);
  });

  test('Catalog and Search routes tenant isolation', async ({ page }) => {
    // 1. Catalog route on Store A vs Store B
    await page.goto(`${STORE_A_BASE_URL}/en/products`);
    const catalogA = await page.content();
    expect(catalogA).toContain('Product A');
    expect(catalogA).not.toContain('Product B');

    await page.goto(`${STORE_B_BASE_URL}/ar/products`);
    const catalogB = await page.content();
    expect(catalogB).toContain('Product B');
    expect(catalogB).not.toContain('Product A');

    // 2. Search route on Store A vs Store B
    await page.goto(`${STORE_A_BASE_URL}/en/search?q=Product`);
    const searchA = await page.content();
    expect(searchA).toContain('Product A');
    expect(searchA).not.toContain('Product B');

    await page.goto(`${STORE_B_BASE_URL}/ar/search?q=Product`);
    const searchB = await page.content();
    expect(searchB).toContain('Product B');
    expect(searchB).not.toContain('Product A');
  });

  test('Same-path under two stores returns store-specific content and pricing', async ({ page }) => {
    // Store A shared product page
    await page.goto(`${STORE_A_BASE_URL}/en/products/shared-slug`);
    const contentA = await page.content();
    expect(contentA).toContain('Shared Product');
    expect(contentA).toContain('150.00'); // Store A price
    expect(contentA).not.toContain('180.00');

    // Store B shared product page
    await page.goto(`${STORE_B_BASE_URL}/en/products/shared-slug`);
    const contentB = await page.content();
    expect(contentB).toContain('Shared Product');
    expect(contentB).toContain('180.00'); // Store B price
    expect(contentB).not.toContain('150.00');
  });

  test('Store ID / Seller ID parameter confusion does not override Host tenant authority', async ({ page }) => {
    await page.goto(`${STORE_A_BASE_URL}/en?store_id=store-b-id&seller_id=seller-b-id`);
    const content = await page.content();
    expect(content).toContain('Store A');
    expect(content).toContain(STORE_A_MARKER);
    expect(content).not.toContain('Store B');
    expect(content).not.toContain(STORE_B_MARKER);
  });

  test('Rapid tenant switching in a single browser context preserves complete isolation', async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      await page.goto(`${STORE_A_BASE_URL}/en`);
      await page.waitForSelector('text=Store A');
      const textA = await page.textContent('body');
      expect(textA).toContain('Store A');
      expect(textA).not.toContain('Store B');

      await page.goto(`${STORE_B_BASE_URL}/ar`);
      await page.waitForSelector('text=Store B');
      const textB = await page.textContent('body');
      expect(textB).toContain('Store B');
      expect(textB).not.toContain('Store A');
    }
  });

  test('RTL / LTR direction and locale isolation', async ({ page }) => {
    // Store A English -> LTR
    await page.goto(`${STORE_A_BASE_URL}/en`);
    const dirA = await page.getAttribute('html', 'dir');
    const langA = await page.getAttribute('html', 'lang');
    expect(dirA || 'ltr').toBe('ltr');
    expect(langA).toBe('en');

    // Store B Arabic -> RTL
    await page.goto(`${STORE_B_BASE_URL}/ar`);
    const dirB = await page.getAttribute('html', 'dir');
    const langB = await page.getAttribute('html', 'lang');
    expect(dirB).toBe('rtl');
    expect(langB).toBe('ar');
  });
});
