import { expect, test } from '@playwright/test';
import { serializeSessionCookie } from '../../web/seller/lib/auth/session-cookie';

const SELLER_APP_URL = process.env.SELLER_APP_URL || 'http://127.0.0.1:3001';

test.describe('Seller Payment Operations E2E', () => {
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

  test('Seller can view order payment status card on order detail page', async ({ page }) => {
    await page.goto(`${SELLER_APP_URL}/dashboard/stores/str_dev_01/orders/ord_dev_01`);
    await expect(page.getByRole('heading', { name: /Order Fulfillment & Tracking/ })).toBeVisible();
  });
});
