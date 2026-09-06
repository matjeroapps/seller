import { test, expect } from '@playwright/test';
import { STORE_A_BASE_URL, bumpRevision, updateProductField } from './support/fixtures';

// P5.8 Buy Now regression: the dedicated Buy Now Cart must never touch the
// normal Cart. A normal Cart holding Product X stays intact while a Buy Now
// purchase of Product Y is checked out as its own order.

test('Buy Now preserves the normal cart', async ({ page, context }) => {
  // Make Product A a Buy Now product for this run.
  await updateProductField('store-a.localhost', 'product-a', 'purchase_behavior', 'buy_now');
  await bumpRevision('store-a.localhost');

  // 1. Normal Cart A gets Product X (shared product, add-to-cart).
  await page.goto(`${STORE_A_BASE_URL}/en/products/shared-slug`);
  await page.click('.add-to-cart-btn');
  await expect(page.locator('.purchase-control__success')).toBeVisible();

  let cookies = await context.cookies();
  const cartCookie = cookies.find((c) => c.name === 'matjero_cart');
  expect(cartCookie).toBeTruthy();

  // 2. Buy Now Product Y — dedicated cart, no global overwrite.
  await page.goto(`${STORE_A_BASE_URL}/en/products/product-a`);
  const buyNow = page.locator('button:has-text("Buy Now"), button:has-text("اشتري الآن")');
  await expect(buyNow).toBeVisible();
  await buyNow.click();

  // 3. Buy Now goes straight to its own checkout session.
  await expect(page).toHaveURL(/\/en\/checkout/, { timeout: 15_000 });
  await page.fill('#recipientName', 'Buy Now Buyer');
  await page.fill('#contactEmail', 'buynow@matjero.test');
  await page.fill('#addressLine1', '2 Buy Now St');
  await page.fill('#city', 'Cairo');
  await page.fill('#countryCode', 'EG');
  await page.click('.checkout-form button[type="submit"]');
  await expect(page).toHaveURL(/\/en\/orders\/.+/, { timeout: 30_000 });
  await expect(page.locator('.order-status')).toContainText('Pending');

  // 4. Return to the normal Cart A: Product X is still there, Product Y is not.
  await page.goto(`${STORE_A_BASE_URL}/en/cart`);
  await expect(page.locator('.cart-table')).toBeVisible();
  await expect(page.locator('.cart-table')).toContainText('sku-shared-a');
  await expect(page.locator('.cart-table')).not.toContainText('sku-a-1');
});
