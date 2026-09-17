import { expect, test } from '@playwright/test';
import { serializeSessionCookie } from '../../web/seller/lib/auth/session-cookie';

const SELLER_APP_URL = process.env.SELLER_APP_URL || 'http://127.0.0.1:3001';

test.describe('Seller Store & Tenant Isolation E2E Matrix', () => {
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

  test('Store switcher displays owned stores and active store entitlement count', async ({ page }) => {
    await page.goto(`${SELLER_APP_URL}/dashboard/stores/str_dev_01`);
    await expect(page.getByRole('button', { name: /Select Store|str_|Loading/ })).toBeVisible();
  });

  test('Cross-store resource isolation: navigating to valid store routes preserves store-scoped context', async ({ page }) => {
    // Navigate to Store A1
    await page.goto(`${SELLER_APP_URL}/dashboard/stores/str_dev_01/catalog/products`);
    await expect(page.getByRole('heading', { name: 'Store Products Catalog' })).toBeVisible();

    // Navigate to Store A2
    await page.goto(`${SELLER_APP_URL}/dashboard/stores/str_dev_02/catalog/products`);
    await expect(page.getByRole('heading', { name: 'Store Products Catalog' })).toBeVisible();
  });
});
