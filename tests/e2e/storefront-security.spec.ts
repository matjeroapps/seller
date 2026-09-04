import { test, expect } from '@playwright/test';
import {
  STORE_A_BASE_URL,
  STORE_B_BASE_URL,
  STORE_A_MARKER,
  STORE_B_MARKER,
  STOREFRONT_API_URL,
  getUniqueTestRevision,
  setCoreUnavailable,
  setExtraFieldsMode,
  setRevision,
  getExtraFieldEmissions,
  resetFakeCore,
} from './support/fixtures';

test.beforeEach(async () => {
  await resetFakeCore();
});

test.describe('Storefront Security & Privacy Regression', () => {
  test('Host spoofing via X-Forwarded-Host is rejected when not explicitly trusted', async ({ request }) => {
    const res = await request.get(`${STORE_A_BASE_URL}/en`, {
      headers: {
        'X-Forwarded-Host': 'store-b.localhost:3000',
        'Forwarded': 'host=store-b.localhost:3000',
        'X-Matjero-Storefront-Host': 'store-b.localhost',
      },
    });
    const text = await res.text();
    expect(text).toContain('Store A');
    expect(text).toContain(STORE_A_MARKER);
    expect(text).not.toContain('Store B');
    expect(text).not.toContain(STORE_B_MARKER);
  });

  test('Host normalization proof: uppercase, port handling, and malformed host handling', async ({ request }) => {
    // 1. Uppercase host
    const resUpper = await request.get(`http://STORE-A.LOCALHOST:3000/en`);
    expect(resUpper.status()).toBe(200);
    const textUpper = await resUpper.text();
    expect(textUpper).toContain('Store A');

    // 2. Direct storefront-api host normalization unit check via router
    const resApi = await request.get(`${STOREFRONT_API_URL}/v1/storefront/store`, {
      headers: { Host: 'STORE-A.LOCALHOST:8080' },
    });
    expect(resApi.status()).toBe(200);
    const jsonApi = await resApi.json();
    expect(jsonApi.store.store_code).toBe('store-a');
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

  test('Cross-store IDOR: Store A host with Store B product slug returns HTTP 404', async ({ page }) => {
    const response = await page.goto(`${STORE_A_BASE_URL}/en/products/product-b`);
    expect(response?.status()).toBe(404);

    const content = await page.content();
    expect(content).not.toContain('Product B');
    expect(content).not.toContain('STORE_B_ONLY_MARKER');
    expect(content).not.toContain('internal_error');
  });

  test('Category / path isolation: Unknown or rival category slug returns HTTP 404', async ({ page }) => {
    // 1. Unknown category on Store A -> 404
    const resUnknown = await page.goto(`${STORE_A_BASE_URL}/en/categories/unknown-category`);
    expect(resUnknown?.status()).toBe(404);

    // 2. Store B category slug on Store A host -> 404
    const resRival = await page.goto(`${STORE_A_BASE_URL}/en/categories/fashion`);
    expect(resRival?.status()).toBe(404);

    // 3. Encoded path traversal segment -> 404
    const resEncoded = await page.goto(`${STORE_A_BASE_URL}/en/categories/%2e%2e%2ffashion`);
    expect(resEncoded?.status()).toBe(404);
  });

  test('Deterministic XSS protection: theme config text renders safely without JS execution', async ({ page }) => {
    // Initialize window execution marker before navigation
    await page.addInitScript(() => {
      (window as any).__MATJERO_XSS__ = undefined;
    });

    await page.goto(`${STORE_A_BASE_URL}/en`);
    await page.waitForLoadState('domcontentloaded');

    // Assert no XSS payload executed in browser context
    const xssMarker = await page.evaluate(() => (window as any).__MATJERO_XSS__);
    expect(xssMarker).toBeUndefined();

    // Verify HTML escaping of the malicious theme string in hero title
    const content = await page.content();
    expect(content).toContain('Store A Title STORE_A_THEME_MARKER');
    expect(content).not.toContain('<script>window.__MATJERO_XSS__');
  });

  test('Deterministic XSS protection: product description renders safely without JS execution', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__MATJERO_XSS__ = undefined;
    });

    await page.goto(`${STORE_A_BASE_URL}/en/products/product-a`);
    await page.waitForLoadState('domcontentloaded');

    const xssMarker = await page.evaluate(() => (window as any).__MATJERO_XSS__);
    expect(xssMarker).toBeUndefined();
  });

  test('Seller public boundary privacy: raw extra internal fields are NEVER proxied to public HTML/JSON', async ({ page, request }) => {
    // 1. Enable extra internal fields on Fake Core (supplier_id, wholesale_price_minor, etc.)
    await setExtraFieldsMode(true);

    // 2. Set a unique revision to guarantee an uncached Redis lookup
    await setRevision('store-a.localhost', getUniqueTestRevision());

    const emissionsBefore = await getExtraFieldEmissions();

    // 3. Fetch public storefront-api JSON response directly (uncached revision)
    const apiRes = await request.get(`${STOREFRONT_API_URL}/v1/storefront/products/product-a`, {
      headers: { Host: 'store-a.localhost' },
    });
    expect(apiRes.status()).toBe(200);
    const apiText = await apiRes.text();

    const emissionsAfter = await getExtraFieldEmissions();
    expect(emissionsAfter).toBeGreaterThan(emissionsBefore);

    // Prove storefront-api stripped the raw extra fields before returning JSON
    expect(apiText).not.toContain('SUPPLIER_FORBIDDEN_MARKER');
    expect(apiText).not.toContain('SUPPLIER_CONTACT_FORBIDDEN');
    expect(apiText).not.toContain('OFFER_FORBIDDEN_MARKER');
    expect(apiText).not.toContain('wholesale_price_minor');
    expect(apiText).not.toContain('supplier_margin_minor');

    // 4. Fetch Next.js rendered product detail page HTML (uses sanitized cached response)
    await page.goto(`${STORE_A_BASE_URL}/en/products/product-a`);
    const html = await page.content();

    expect(html).toContain('Product A');
    expect(html).not.toContain('SUPPLIER_FORBIDDEN_MARKER');
    expect(html).not.toContain('SUPPLIER_CONTACT_FORBIDDEN');
    expect(html).not.toContain('OFFER_FORBIDDEN_MARKER');
    expect(html).not.toContain('wholesale_price_minor');
    expect(html).not.toContain('supplier_margin_minor');

    // Clean up extra fields mode
    await setExtraFieldsMode(false);
  });

  test('Supplier privacy: internal IDs, wholesale costs, margins, and offer IDs are NEVER exposed', async ({ page }) => {
    await page.goto(`${STORE_A_BASE_URL}/en/products/product-a`);
    const htmlA = await page.content();

    expect(htmlA).not.toContain('SUPPLIER_INT_123_FORBIDDEN');
    expect(htmlA).not.toContain('OFFER_INT_789_FORBIDDEN');
    expect(htmlA).not.toContain('wholesale_cost');
    expect(htmlA).not.toContain('_forbidden');

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
    expect(text).toContain('100.00');
    expect(text).not.toContain('50.00');
  });

  test('Core unavailable behavior and recovery: Core outage returns HTTP 503 strictly', async ({ request, page }) => {
    // 1. Simulate Core outage
    await setCoreUnavailable(true);

    // Direct service API call MUST return HTTP 503
    const apiRes = await request.get(`${STOREFRONT_API_URL}/v1/storefront/store`, {
      headers: { Host: 'store-a.localhost' },
    });
    expect(apiRes.status()).toBe(503);
    const apiText = await apiRes.text();
    expect(apiText).not.toContain('CORE_API_TOKEN');
    expect(apiText).not.toContain('http://127.0.0.1:18080');

    // Next.js storefront web handles outage safely without details leakage
    const webRes = await request.get(`${STORE_A_BASE_URL}/en`);
    const webText = await webRes.text();
    expect(webText).not.toContain('CORE_API_TOKEN');
    expect(webText).not.toContain('http://127.0.0.1:18080');
    expect(webText).not.toContain('stack');

    // 2. Restore Core health
    await setCoreUnavailable(false);

    await page.goto(`${STORE_A_BASE_URL}/en`);
    const recoveredText = await page.content();
    expect(recoveredText).toContain('Store A');
    expect(recoveredText).toContain(STORE_A_MARKER);
  });
});
