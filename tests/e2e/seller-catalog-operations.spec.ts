import { expect, test } from '@playwright/test';
import { serializeSessionCookie } from '../../web/seller/lib/auth/session-cookie';

const SELLER_APP_URL = process.env.SELLER_APP_URL || 'http://127.0.0.1:3001';

test.describe('Seller Catalog Operations E2E', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: 'mh_seller_session',
        value: await serializeSessionCookie({
          isAuthenticated: true,
          user: {
            id: 'usr_seller_dev',
            email: 'seller-owner@matjero.test',
            name: 'Seller Owner',
            roles: ['seller_owner'],
            tenantId: 'tenant-dev'
          },
          expiresAt: Date.now() + 60 * 60 * 1000
        }),
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax'
      }
    ]);
  });

  test('Seller can navigate store products catalog and view products list', async ({ page }) => {
    await page.goto(`${SELLER_APP_URL}/dashboard/stores/str_dev_01/catalog/products`);
    await expect(page.getByRole('heading', { name: 'Store Products Catalog' })).toBeVisible();
    await expect(page.getByText('Source:')).toBeVisible();
    await expect(page.getByRole('link', { name: /Create Product/ })).toBeVisible();
  });

  test('Seller can navigate to supplier offers and search eligible catalog', async ({ page }) => {
    await page.goto(`${SELLER_APP_URL}/dashboard/stores/str_dev_01/catalog/supplier-offers`);
    await expect(page.getByRole('heading', { name: 'Supplier Offers Catalog' })).toBeVisible();
    await expect(page.getByPlaceholder('Search supplier offers by product name, supplier, or category...')).toBeVisible();
  });

  test('Seller can view store listings and readiness inspection panel', async ({ page }) => {
    await page.goto(`${SELLER_APP_URL}/dashboard/stores/str_dev_01/catalog/listings`);
    await expect(page.getByRole('heading', { name: 'Store Listings' })).toBeVisible();
  });

  test('Seller can view store media library and presigned upload UI', async ({ page }) => {
    await page.goto(`${SELLER_APP_URL}/dashboard/stores/str_dev_01/media`);
    await expect(page.getByRole('heading', { name: 'Store Media Library' })).toBeVisible();
    // Exact match: the empty-state message also mentions "Upload Media".
    await expect(page.getByText('Upload Media', { exact: true })).toBeVisible();
  });

  test('Seller can view inventory snapshots and stock adjustment interface', async ({ page }) => {
    await page.goto(`${SELLER_APP_URL}/dashboard/stores/str_dev_01/inventory`);
    await expect(page.getByRole('heading', { name: 'Store Inventory Snapshots' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Adjust Inventory Stock' })).toBeVisible();
  });

  test('Seller can view canonical storefront host settings', async ({ page }) => {
    await page.goto(`${SELLER_APP_URL}/dashboard/stores/str_dev_01/storefront`);
    await expect(page.getByRole('heading', { name: 'Canonical Storefront Settings' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Open Canonical Customer Storefront/ })).toBeVisible();
  });
});
