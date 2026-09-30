import { expect, test } from '@playwright/test';

import { serializeSessionCookie } from '../../web/seller/lib/auth/session-cookie';

const SELLER_APP_URL = process.env.SELLER_APP_URL || 'http://127.0.0.1:3001';

test('UI-5 seller portal foundation protects and renders dashboard shell', async ({ context, page }) => {
  await page.goto(`${SELLER_APP_URL}/dashboard`);
  await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard$/);
  await expect(page.getByRole('heading', { name: 'Sign in to manage your commerce workspace' })).toBeVisible();

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

  await page.goto(`${SELLER_APP_URL}/dashboard`);
  await expect(page).toHaveURL(/\/dashboard\/stores\/[a-zA-Z0-9_-]+$/);
  await expect(page.getByRole('heading', { name: /Store A|Store-A|Store Dashboard/ })).toBeVisible();
  await expect(page.getByText('Launch Readiness')).toBeVisible();
  await expect(page.getByText('Products', { exact: true })).toBeVisible();
  await expect(page.getByText('Supplier Offers')).toBeVisible();

  await page.goto(`${SELLER_APP_URL}/dashboard/stores/str_dev_01/catalog/products`);
  await expect(page.getByRole('heading', { name: 'Store Products Catalog' })).toBeVisible();
});
