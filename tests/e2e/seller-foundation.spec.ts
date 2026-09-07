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
          id: 'usr_seller_e2e',
          email: 'seller-e2e@matjero.test',
          name: 'Seller E2E',
          roles: ['seller_owner'],
          tenantId: 'tenant-e2e'
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
  await expect(page.getByRole('heading', { name: 'Seller Dashboard' })).toBeVisible();
  await expect(page.getByText('Total Products')).toBeVisible();
  await expect(page.getByText('Active Orders')).toBeVisible();
  await expect(page.getByText('Revenue', { exact: true })).toBeVisible();
  await expect(page.getByText('Inventory Alerts')).toBeVisible();
  await expect(page.getByRole('button', { name: /Catalog/ })).toBeVisible();

  await page.goto(`${SELLER_APP_URL}/dashboard/catalog`);
  await expect(page.getByRole('heading', { name: 'Catalog foundation' })).toBeVisible();
  await expect(page.getByText('Business workflows and API-backed behavior are deferred beyond Phase UI-5.')).toBeVisible();
});
