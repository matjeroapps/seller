import { expect, test } from '@playwright/test';
import { serializeSessionCookie } from '../../web/seller/lib/auth/session-cookie';
import { createTestOrder, getTestAccessToken, prepareOrderForShipment } from './support/fixtures';

const SELLER_APP_URL = process.env.SELLER_APP_URL || 'http://127.0.0.1:3001';

test.describe('Seller Shipping Operations E2E', () => {
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

  test('Seller can view order fulfillment interface and shipments timeline', async ({ page, request }) => {
    const { storeId, orderId } = await createTestOrder(request);
    const accessToken = await getTestAccessToken(request);
    await prepareOrderForShipment(request, storeId, orderId, accessToken);
    await page.goto(`${SELLER_APP_URL}/dashboard/stores/${storeId}/orders/${orderId}`);
    await expect(page.getByRole('heading', { name: /Order Fulfillment & Tracking/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Shipment/ })).toBeVisible();
  });

  test('Seller can view store shipments overview page with status filters', async ({ page }) => {
    await page.goto(`${SELLER_APP_URL}/dashboard/stores/str_dev_01/shipments`);
    await expect(page.getByRole('heading', { name: 'Store Shipments Queue' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ALL' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'PENDING' })).toBeVisible();
  });
});
