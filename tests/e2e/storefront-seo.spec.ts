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

  test('Canonical and OpenGraph metadata use resolved Store host', async ({ page }) => {
    await page.goto(`${STORE_A_BASE_URL}/en`);

    const canonicalHref = await page.getAttribute('link[rel="canonical"]', 'href');
    if (canonicalHref) {
      expect(canonicalHref).toContain('store-a.localhost');
      expect(canonicalHref).not.toContain('store-b.localhost');
    }

    const ogUrl = await page.getAttribute('meta[property="og:url"]', 'content');
    if (ogUrl) {
      expect(ogUrl).toContain('store-a.localhost');
      expect(ogUrl).not.toContain('store-b.localhost');
    }
  });

  test('Open Redirect Review: Root and locale redirects never redirect to external URLs', async ({ request }) => {
    // Attempting query parameter injection for external open redirect
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
