import { test, expect } from '@playwright/test';
import {
  STORE_A_BASE_URL,
  STORE_B_BASE_URL,
  resetFakeCore,
} from './support/fixtures';

test.beforeEach(async () => {
  await resetFakeCore();
});

test.describe('Storefront SEO & Sitemap Isolation', () => {
  test('Store A sitemap contains only Store A URLs and slugs', async ({ request }) => {
    const res = await request.get(`${STORE_A_BASE_URL}/sitemap.xml`);
    expect(res.status()).toBe(200);
    const body = await res.text();

    expect(body).toContain('store-a.localhost');
    expect(body).toContain('product-a');
    expect(body).toContain('electronics');

    expect(body).not.toContain('store-b.localhost');
    expect(body).not.toContain('product-b');
    expect(body).not.toContain('fashion');
  });

  test('Store B sitemap contains only Store B URLs and slugs', async ({ request }) => {
    const res = await request.get(`${STORE_B_BASE_URL}/sitemap.xml`);
    expect(res.status()).toBe(200);
    const body = await res.text();

    expect(body).toContain('store-b.localhost');
    expect(body).toContain('product-b');
    expect(body).toContain('fashion');

    expect(body).not.toContain('store-a.localhost');
    expect(body).not.toContain('product-a');
    expect(body).not.toContain('electronics');
  });

  test('Robots.txt points to correct store-specific sitemap', async ({ request }) => {
    const resA = await request.get(`${STORE_A_BASE_URL}/robots.txt`);
    const bodyA = await resA.text();
    expect(bodyA).toContain('store-a.localhost/sitemap.xml');

    const resB = await request.get(`${STORE_B_BASE_URL}/robots.txt`);
    const bodyB = await resB.text();
    expect(bodyB).toContain('store-b.localhost/sitemap.xml');
  });

  test('Canonical tag existence and tenant isolation', async ({ page }) => {
    // Store A
    await page.goto(`${STORE_A_BASE_URL}/en`);
    const canonicalA = page.locator('link[rel="canonical"]');
    await expect(canonicalA).toHaveCount(1);
    const hrefA = await canonicalA.getAttribute('href');
    expect(hrefA).toBeTruthy();
    expect(hrefA).toContain('store-a.localhost');
    expect(hrefA).not.toContain('store-b.localhost');
    expect(hrefA).toMatch(/\/en$/);

    // Store B
    await page.goto(`${STORE_B_BASE_URL}/ar`);
    const canonicalB = page.locator('link[rel="canonical"]');
    await expect(canonicalB).toHaveCount(1);
    const hrefB = await canonicalB.getAttribute('href');
    expect(hrefB).toBeTruthy();
    expect(hrefB).toContain('store-b.localhost');
    expect(hrefB).not.toContain('store-a.localhost');
    expect(hrefB).toMatch(/\/ar$/);
  });

  test('Hreflang language alternates existence and tenant isolation', async ({ page }) => {
    // Store A
    await page.goto(`${STORE_A_BASE_URL}/en`);
    const hreflangEn = page.locator('link[rel="alternate"][hreflang="en"]');
    const hreflangAr = page.locator('link[rel="alternate"][hreflang="ar"]');
    const hreflangDefault = page.locator('link[rel="alternate"][hreflang="x-default"]');

    await expect(hreflangEn).toHaveCount(1);
    await expect(hreflangAr).toHaveCount(1);
    await expect(hreflangDefault).toHaveCount(1);

    const hrefEn = await hreflangEn.getAttribute('href');
    const hrefAr = await hreflangAr.getAttribute('href');
    expect(hrefEn).toContain('store-a.localhost/en');
    expect(hrefAr).toContain('store-a.localhost/ar');
    expect(hrefEn).not.toContain('store-b.localhost');
    expect(hrefAr).not.toContain('store-b.localhost');

    // Store B
    await page.goto(`${STORE_B_BASE_URL}/ar`);
    const bHreflangAr = page.locator('link[rel="alternate"][hreflang="ar"]');
    const bHreflangEn = page.locator('link[rel="alternate"][hreflang="en"]');

    await expect(bHreflangAr).toHaveCount(1);
    await expect(bHreflangEn).toHaveCount(1);

    const bHrefAr = await bHreflangAr.getAttribute('href');
    const bHrefEn = await bHreflangEn.getAttribute('href');
    expect(bHrefAr).toContain('store-b.localhost/ar');
    expect(bHrefEn).toContain('store-b.localhost/en');
    expect(bHrefAr).not.toContain('store-a.localhost');
    expect(bHrefEn).not.toContain('store-a.localhost');
  });

  test('OpenGraph metadata existence and tenant isolation', async ({ page }) => {
    await page.goto(`${STORE_A_BASE_URL}/en`);
    const ogUrl = page.locator('meta[property="og:url"]');
    const ogSiteName = page.locator('meta[property="og:site_name"]');
    const ogTitle = page.locator('meta[property="og:title"]');

    await expect(ogUrl).toHaveCount(1);
    await expect(ogSiteName).toHaveCount(1);
    await expect(ogTitle).toHaveCount(1);

    const urlVal = await ogUrl.getAttribute('content');
    const siteVal = await ogSiteName.getAttribute('content');
    const titleVal = await ogTitle.getAttribute('content');

    expect(urlVal).toContain('store-a.localhost');
    expect(urlVal).not.toContain('store-b.localhost');
    expect(siteVal).toBe('Store A');
    expect(titleVal).toContain('Store A');
  });

  test('Twitter metadata existence and tenant isolation', async ({ page }) => {
    await page.goto(`${STORE_A_BASE_URL}/en`);
    const twitterCard = page.locator('meta[name="twitter:card"]');
    const twitterTitle = page.locator('meta[name="twitter:title"]');

    await expect(twitterCard).toHaveCount(1);
    await expect(twitterTitle).toHaveCount(1);

    const cardVal = await twitterCard.getAttribute('content');
    const titleVal = await twitterTitle.getAttribute('content');

    expect(cardVal).toBeTruthy();
    expect(titleVal).toContain('Store A');
    expect(titleVal).not.toContain('Store B');
  });

  test('Product JSON-LD existence, structure and privacy isolation', async ({ page }) => {
    // Store A Product A
    await page.goto(`${STORE_A_BASE_URL}/en/products/product-a`);
    const scriptLocator = page.locator('script[type="application/ld+json"]');
    await expect(scriptLocator).toHaveCount(1);

    const jsonText = await scriptLocator.textContent();
    expect(jsonText).toBeTruthy();
    const data = JSON.parse(jsonText!);

    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('Product');
    expect(data['name']).toBe('Product A');
    expect(data['url']).toContain('store-a.localhost/en/products/product-a');
    expect(data['offers']).toBeDefined();
    expect(data['offers']['price']).toBe(100);
    expect(data['offers']['priceCurrency']).toBe('EGP');

    // Forbidden markers check in JSON-LD text
    expect(jsonText).not.toContain('store-b.localhost');
    expect(jsonText).not.toContain('SUPPLIER_INT_123_FORBIDDEN');
    expect(jsonText).not.toContain('OFFER_INT_789_FORBIDDEN');
    expect(jsonText).not.toContain('wholesale_cost');
    expect(jsonText).not.toContain('margin');

    // Store B Product B
    await page.goto(`${STORE_B_BASE_URL}/ar/products/product-b`);
    const scriptB = page.locator('script[type="application/ld+json"]');
    await expect(scriptB).toHaveCount(1);
    const textB = await scriptB.textContent();
    const dataB = JSON.parse(textB!);

    expect(dataB['name']).toBe('Product B');
    expect(dataB['url']).toContain('store-b.localhost/ar/products/product-b');
    expect(dataB['offers']['price']).toBe(250);
    expect(textB).not.toContain('store-a.localhost');
  });

  test('Preview page SEO safety: robots noindex and JSON-LD suppression', async ({ page }) => {
    // Valid preview page for Store A
    await page.goto(`${STORE_A_BASE_URL}/en?theme_preview=valid-preview-token-store-a`);

    const robotsLocator = page.locator('meta[name="robots"]');
    await expect(robotsLocator).toHaveCount(1);
    const robotsContent = await robotsLocator.getAttribute('content');
    expect(robotsContent).toContain('noindex');

    // Product JSON-LD must be suppressed on preview
    await page.goto(`${STORE_A_BASE_URL}/en/products/product-a?theme_preview=valid-preview-token-store-a`);
    const previewScript = page.locator('script[type="application/ld+json"]');
    await expect(previewScript).toHaveCount(0);
  });

  test('Open Redirect Review: Root and locale redirects never redirect to external URLs', async ({ request }) => {
    const res = await request.get(`${STORE_A_BASE_URL}/?redirect=https://attacker.example`, {
      maxRedirects: 0,
    });
    const location = res.headers()['location'] || '';
    if (location) {
      expect(location).not.toContain('attacker.example');
      expect(location.startsWith('/') || location.includes('store-a.localhost')).toBe(true);
    }
  });
});
