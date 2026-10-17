import { expect, test } from '@playwright/test';
import { serializeSessionCookie } from '../../web/seller/lib/auth/session-cookie';
import { getTestAccessToken } from './support/fixtures';

const SELLER_APP_URL = process.env.SELLER_APP_URL || 'http://127.0.0.1:3001';

test.describe('Seller Catalog Operations E2E', () => {
  test.beforeEach(async ({ context, request }) => {
    const accessToken = await getTestAccessToken(request);
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
          expiresAt: Date.now() + 60 * 60 * 1000,
          accessToken
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

  test('Seller can search, filter, and toggle catalog views via stable anchors', async ({ page }) => {
    await page.goto(`${SELLER_APP_URL}/dashboard/stores/str_dev_01/catalog/products`);
    await expect(page.getByTestId('product-search')).toBeVisible();
    await expect(page.getByTestId('product-filter-source')).toBeVisible();
    await expect(page.getByTestId('product-filter-status')).toBeVisible();
    await expect(page.getByTestId('product-create')).toBeVisible();

    await page.getByTestId('product-search').fill('phone');
    await expect(page.getByText(/of \d+/).first()).toBeVisible();

    const gridToggle = page.getByRole('button', { name: /grid view/i });
    await gridToggle.click();
    await expect(page.getByTestId('product-grid-view')).toBeVisible();
    await expect(page.getByRole('button', { name: /list view/i })).toBeVisible();
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
    await page.goto(`${SELLER_APP_URL}/dashboard/stores/store-a/storefront`);
    await expect(page.getByRole('heading', { name: 'Canonical Storefront Settings' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Open Canonical Customer Storefront/ })).toBeVisible();
  });
});
