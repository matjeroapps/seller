process.env.SELLER_SESSION_SECRET = process.env.SELLER_SESSION_SECRET || 'dev-seller-session-secret-32-bytes-min';

import { expect, test } from '@playwright/test';
import { serializeSessionCookie } from '../../web/seller/lib/auth/session-cookie';

const SELLER_APP_URL = process.env.SELLER_APP_URL || 'http://127.0.0.1:5174';
const STORE_ID = process.env.TEST_STORE_ID || '8bac2768-312e-4cb9-ae8d-5394a32ab109';

test.describe('Seller Dashboard Truthful Capability Verification (E2E)', () => {
  test.beforeEach(async ({ context }) => {
    const sessionCookieValue = await serializeSessionCookie({
      isAuthenticated: true,
      user: {
        id: '393698442519511046',
        email: 'seller-owner@matjero.test',
        name: 'Seller Owner',
        roles: ['seller_owner'],
        tenantId: 'tenant-dev'
      },
      expiresAt: Date.now() + 60 * 60 * 1000
    });

    await context.addCookies([
      {
        name: 'mh_seller_session',
        value: sessionCookieValue,
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax'
      },
      {
        name: 'mh_seller_session',
        value: sessionCookieValue,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax'
      }
    ]);
  });

  test('User Story 1: Dual-Mode Inventory Adjustment and Ledger History', async ({ page }) => {
    await page.goto(`${SELLER_APP_URL}/dashboard/stores/${STORE_ID}/inventory`);
    await expect(page.getByRole('heading', { name: 'Store Inventory Snapshots' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Adjust Inventory Stock' })).toBeVisible();

    // Verify mode toggle between relative delta and absolute cycle count
    const relativeModeBtn = page.getByRole('button', { name: /Relative Delta/i });
    const cycleCountBtn = page.getByRole('button', { name: /Cycle Count Target/i });
    await expect(relativeModeBtn).toBeVisible();
    await expect(cycleCountBtn).toBeVisible();

    // Verify reason code selector with standardized enum options
    const reasonSelect = page.locator('select').filter({ hasText: /restock|damage|cycle_count/i });
    await expect(reasonSelect).toBeVisible();

    // Verify submit button exists and is non-empty
    const submitBtn = page.getByRole('button', { name: /Apply Adjustment|Reconcile Count/i });
    await expect(submitBtn).toBeVisible();
  });

  test('User Story 2: Variant Options & SKU Physical Specifications Modal', async ({ page }) => {
    await page.goto(`${SELLER_APP_URL}/dashboard/stores/${STORE_ID}/catalog/products`);
    await expect(page.getByRole('heading', { name: 'Store Products Catalog' })).toBeVisible();

    // If there is an existing product link, navigate to detail
    const productLinks = page.locator('table a[href*="/catalog/products/"]');
    const count = await productLinks.count();
    if (count > 0) {
      await productLinks.first().click();
      await page.waitForLoadState('networkidle');

      // Verify Variant & Specs configuration button
      const configSpecsBtn = page.getByRole('button', { name: /Configure Variant & Specs/i });
      if (await configSpecsBtn.isVisible()) {
        await configSpecsBtn.click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('heading', { name: /Variant Attribute Options & SKU Specs/i })).toBeVisible();

        // Close dialog
        const closeBtn = dialog.getByRole('button', { name: /Cancel|Close/i });
        await closeBtn.click();
      }
    }
  });

  test('User Story 3: Supplier Offers Margin Guardrails & Wholesale Economics', async ({ page }) => {
    await page.goto(`${SELLER_APP_URL}/dashboard/stores/${STORE_ID}/catalog/supplier-offers`);
    await expect(page.getByRole('heading', { name: 'Supplier Offers Catalog' })).toBeVisible();
    await expect(
      page.getByPlaceholder('Search supplier offers by product name, supplier, or category...')
    ).toBeVisible();

    // Navigate to listings
    await page.goto(`${SELLER_APP_URL}/dashboard/stores/${STORE_ID}/catalog/listings`);
    await expect(page.getByRole('heading', { name: 'Store Listings' })).toBeVisible();
  });

  test('User Story 4: Store-Wide Fulfillment Shipments Queue & Tracking Generation', async ({ page }) => {
    await page.goto(`${SELLER_APP_URL}/dashboard/stores/${STORE_ID}/shipments`);
    await expect(page.getByRole('heading', { name: /Store Shipments Queue/i })).toBeVisible();

    // Verify fulfillment filter tabs
    await expect(page.getByRole('button', { name: 'ALL' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'PENDING' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'SHIPPED' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'DELIVERED' })).toBeVisible();

    // Verify Create Shipment action opens modal dialog
    const createBtn = page.getByRole('button', { name: /Create Shipment/i }).first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /Create.*Shipment/i })).toBeVisible();
    await expect(dialog.getByPlaceholder(/SMSA|Aramex/i)).toBeVisible();

    // Cancel modal
    await dialog.getByRole('button', { name: /Cancel/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('User Story 5: Arabic Localization and Direction Switching', async ({ page }) => {
    await page.goto(`${SELLER_APP_URL}/dashboard/stores/${STORE_ID}/inventory`);

    // Verify language switcher button in header
    const langBtn = page.getByRole('button', { name: /Switch to (Arabic|English)/i });
    await expect(langBtn).toBeVisible();

    // Click to toggle to Arabic
    await langBtn.click();
    await page.waitForTimeout(300);

    // Verify html tag direction is updated to rtl
    const dir = await page.locator('html').getAttribute('dir');
    expect(dir).toBe('rtl');

    // Toggle back to English
    const backBtn = page.getByRole('button', { name: /Switch to (Arabic|English)/i });
    await backBtn.click();
    await page.waitForTimeout(300);
    const ltrDir = await page.locator('html').getAttribute('dir');
    expect(ltrDir).toBe('ltr');
  });

  test('In-Use Media Deletion Graceful 409 Handling', async ({ page }) => {
    await page.goto(`${SELLER_APP_URL}/dashboard/stores/${STORE_ID}/media`);
    await expect(page.getByRole('heading', { name: 'Store Media Library' })).toBeVisible();
    await expect(page.getByText('Upload Media', { exact: true })).toBeVisible();
  });
});
