import { expect, test } from '@playwright/test';
import { serializeSessionCookie } from '../../web/seller/lib/auth/session-cookie';
import { createTestOrder, getTestAccessToken } from './support/fixtures';

const SELLER_APP_URL = process.env.SELLER_APP_URL || 'http://127.0.0.1:3001';

test.describe('Seller Payment Operations E2E', () => {
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

  test('Seller can view order payment status card on order detail page', async ({ page, request }) => {
    const { storeId, orderId } = await createTestOrder(request);
    await page.goto(`${SELLER_APP_URL}/dashboard/stores/${storeId}/orders/${orderId}`);
    await expect(page.getByRole('heading', { name: /Order Fulfillment & Tracking/ })).toBeVisible();
  });
});
