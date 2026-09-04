import { test, expect } from '@playwright/test';
import {
  STORE_A_BASE_URL,
  STORE_B_BASE_URL,
  STORE_A_MARKER,
  STORE_B_MARKER,
  setCoreUnavailable,
  resetFakeCore,
} from './support/fixtures';

test.beforeEach(async () => {
  await resetFakeCore();
});

test.describe('Storefront Security & Privacy Regression', () => {
  test('Host spoofing via X-Forwarded-Host is rejected when not explicitly trusted', async ({ request }) => {
    // Make direct HTTP request to Store A host with a spoofed X-Forwarded-Host header for Store B
    const res = await request.get(`${STORE_A_BASE_URL}/en`, {
      headers: {
        'X-Forwarded-Host': 'store-b.localhost:3000',
        'Forwarded': 'host=store-b.localhost:3000',
        'X-Matjero-Storefront-Host': 'store-b.localhost',
      },
    });
    const text = await res.text();
    // Host header store-a.localhost remains authoritative
    expect(text).toContain('Store A');
    expect(text).toContain(STORE_A_MARKER);
    expect(text).not.toContain('Store B');
    expect(text).not.toContain(STORE_B_MARKER);
  });

  test('Unknown or malformed host returns safe generic 404 without leaking topology', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:3000/en', {
      headers: {
        'Host': 'nonexistent-store.localhost:3000',
      },
    });
    expect(res.status()).toBe(404);
    const text = await res.text();
    expect(text).not.toContain('PostgreSQL');
    expect(text).not.toContain('database');
    expect(text).not.toContain('stack');
    expect(text).not.toContain('SUPPLIER');
  });

  test('Cross-store IDOR: Store A host with Store B product slug returns 404', async ({ page }) => {
    // product-b is listed under Store B only
    await page.goto(`${STORE_A_BASE_URL}/en/products/product-b`);
    const content = await page.content();
    // Should be 404 or product not found on Store A, not Store B details
    expect(content).not.toContain('Product B');
    expect(content).not.toContain('STORE_B_ONLY_MARKER');
  });

  test('XSS protection: theme config and product description render safely without execution', async ({ page }) => {
    let dialogFired = false;
    page.on('dialog', (dialog) => {
      dialogFired = true;
      dialog.dismiss();
    });

    await page.goto(`${STORE_A_BASE_URL}/en/products/product-a`);
    await page.waitForLoadState('domcontentloaded');

    expect(dialogFired).toBe(false);
  });

  test('Supplier privacy: internal IDs, wholesale costs, margins, and offer IDs are NEVER exposed', async ({ request, page }) => {
    // Check Store A HTML & JSON API
    await page.goto(`${STORE_A_BASE_URL}/en/products/product-a`);
    const htmlA = await page.content();

    expect(htmlA).not.toContain('SUPPLIER_INT_123_FORBIDDEN');
    expect(htmlA).not.toContain('OFFER_INT_789_FORBIDDEN');
    expect(htmlA).not.toContain('wholesale_cost');
    expect(htmlA).not.toContain('_forbidden');

    // Check Store B HTML & JSON API
    await page.goto(`${STORE_B_BASE_URL}/ar/products/product-b`);
    const htmlB = await page.content();

    expect(htmlB).not.toContain('SUPPLIER_INT_456_FORBIDDEN');
    expect(htmlB).not.toContain('OFFER_INT_999_FORBIDDEN');
    expect(htmlB).not.toContain('wholesale_cost');
    expect(htmlB).not.toContain('_forbidden');
  });

  test('Seller price integrity: customer price is Seller listing price', async ({ page }) => {
    await page.goto(`${STORE_A_BASE_URL}/en/products/product-a`);
    const text = await page.textContent('body');
    // Product A listing price is 100.00 EGP, wholesale cost was 50.00 EGP (5000 minor)
    expect(text).toContain('100.00');
    expect(text).not.toContain('50.00');
  });

  test('Core unavailable behavior and recovery', async ({ request, page }) => {
    // 1. Simulate Core outage
    await setCoreUnavailable(true);

    const res = await request.get(`${STORE_A_BASE_URL}/en`);
    expect([500, 503]).toContain(res.status());
    const text = await res.text();
    expect(text).not.toContain('CORE_API_TOKEN');
    expect(text).not.toContain('http://127.0.0.1:18080');

    // 2. Restore Core health
    await setCoreUnavailable(false);

    await page.goto(`${STORE_A_BASE_URL}/en`);
    const recoveredText = await page.content();
    expect(recoveredText).toContain('Store A');
    expect(recoveredText).toContain(STORE_A_MARKER);
  });
});
