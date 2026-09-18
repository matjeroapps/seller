import { expect, test } from '@playwright/test';
import { serializeSessionCookie } from '../../web/seller/lib/auth/session-cookie';

const SELLER_APP_URL = process.env.SELLER_APP_URL || 'http://127.0.0.1:3001';

test.describe('Seller Financial Operations E2E', () => {
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

  test('Seller can view store financial balances, ledger, and settlements dashboard', async ({ page }) => {
    await page.goto(`${SELLER_APP_URL}/dashboard/stores/str_dev_01/finance`);
    await expect(page.getByRole('heading', { name: /Financial Ledger & Settlement Operations/ })).toBeVisible();
    await expect(page.getByText('Available Balance')).toBeVisible();
    await expect(page.getByText('Pending Balance')).toBeVisible();
  });
});
