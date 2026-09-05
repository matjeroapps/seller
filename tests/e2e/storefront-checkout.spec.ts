import { test, expect } from '@playwright/test';
import {
  STORE_A_BASE_URL,
  STORE_B_BASE_URL,
  STORE_A_HOST,
  STORE_B_HOST,
  STOREFRONT_API_URL,
  resetFakeCore,
} from './support/fixtures';

test.beforeEach(async () => {
  await resetFakeCore();
});

test.describe('P5.7 Storefront Checkout & Guest Order E2E', () => {
  test('Complete End-to-End Guest Purchase Flow: Product -> Cart -> Checkout -> Order -> Cancel', async ({ page }) => {
    // 1. Visit Product Page
    await page.goto(`${STORE_A_BASE_URL}/en/products/product-a`);
    await expect(page).toHaveURL(`${STORE_A_BASE_URL}/en/products/product-a`);
    await expect(page.locator('.product__title')).toContainText('Product A');

    // 2. Add to Cart
    await page.click('.add-to-cart-btn');
    await expect(page.locator('.purchase-control__success')).toBeVisible();

    // 3. Open Cart
    await page.goto(`${STORE_A_BASE_URL}/en/cart`);
    await expect(page.locator('.cart-table')).toBeVisible();
    await expect(page.locator('.cart-table')).toContainText('sku-a-1');

    // 4. Update Quantity in Cart
    const qtyInput = page.locator('.quantity-input').first();
    await qtyInput.fill('2');
    await qtyInput.blur();

    // 5. Proceed to Checkout
    await page.click('button:has-text("Proceed to Checkout"), button:has-text("إتمام الطلب")');
    await expect(page).toHaveURL(/\/en\/checkout\/.+/);

    // 6. Enter Shipping Address & Contact Email
    await page.fill('#recipientName', 'Jane Doe');
    await page.fill('#contactEmail', 'jane@example.com');
    await page.fill('#addressLine1', '123 Main St');
    await page.fill('#city', 'Cairo');
    await page.fill('#countryCode', 'EG');

    // 7. Finalize Checkout
    await page.click('.checkout-form button[type="submit"]');

    // 8. Redirected to Order Confirmation Page
    await expect(page).toHaveURL(/\/en\/orders\/.+/);
    await expect(page.locator('.order-status')).toContainText('Pending');

    // 9. Verify Capability Security (never appears in DOM, URL, or localStorage)
    const url = page.url();
    expect(url).not.toContain('guest_order_access_token');
    expect(url).not.toContain('token=');

    const domContent = await page.content();
    expect(domContent).not.toContain('guest_order_access_token');

    const localStorageKeys = await page.evaluate(() => Object.keys(localStorage));
    expect(localStorageKeys).not.toContain('matjero_guest_order_token');
    expect(localStorageKeys).not.toContain('guest_order_access_token');

    // 10. Cancel Order
    await page.click('button:has-text("Cancel Order"), button:has-text("إلغاء الطلب")');
    await expect(page.locator('.order-status')).toContainText('Cancelled');
  });

  test('Multiple Guest Orders Remain Independently Accessible', async ({ page, context }) => {
    // Order 1
    await page.goto(`${STORE_A_BASE_URL}/en/products/product-a`);
    await page.click('.add-to-cart-btn');
    await page.goto(`${STORE_A_BASE_URL}/en/cart`);
    await page.click('button:has-text("Proceed to Checkout"), button:has-text("إتمام الطلب")');
    await page.fill('#recipientName', 'Alice');
    await page.fill('#contactEmail', 'alice@example.com');
    await page.fill('#addressLine1', '1 First St');
    await page.fill('#city', 'Alexandria');
    await page.fill('#countryCode', 'EG');
    await page.click('.checkout-form button[type="submit"]');
    await expect(page).toHaveURL(/\/en\/orders\/.+/);
    const order1Url = page.url();

    // Order 2
    await page.goto(`${STORE_A_BASE_URL}/en/products/product-a`);
    await page.click('.add-to-cart-btn');
    await page.goto(`${STORE_A_BASE_URL}/en/cart`);
    await page.click('button:has-text("Proceed to Checkout"), button:has-text("إتمام الطلب")');
    await page.fill('#recipientName', 'Bob');
    await page.fill('#contactEmail', 'bob@example.com');
    await page.fill('#addressLine1', '2 Second St');
    await page.fill('#city', 'Giza');
    await page.fill('#countryCode', 'EG');
    await page.click('.checkout-form button[type="submit"]');
    await expect(page).toHaveURL(/\/en\/orders\/.+/);
    const order2Url = page.url();

    expect(order1Url).not.toEqual(order2Url);

    // Verify Order 1 is still accessible using stored HttpOnly cookie
    await page.goto(order1Url);
    await expect(page.locator('.order-status')).toBeVisible();

    // Verify Order 2 is accessible using stored HttpOnly cookie
    await page.goto(order2Url);
    await expect(page.locator('.order-status')).toBeVisible();
  });

  test('Cross-Host Isolation: Store A Order Capability Rejected on Store B Host', async ({ request }) => {
    // 1. Create Cart on Store A
    const cartRes = await request.post(`${STOREFRONT_API_URL}/v1/storefront/carts`, {
      headers: { Host: STORE_A_HOST }
    });
    expect(cartRes.ok()).toBeTruthy();

    const cartCookieHeader = cartRes.headers()['set-cookie'];
    expect(cartCookieHeader).toBeTruthy();

    // 2. Add Item
    const addRes = await request.post(`${STOREFRONT_API_URL}/v1/storefront/carts/items`, {
      headers: { Host: STORE_A_HOST, Cookie: cartCookieHeader },
      data: { sku_id: 'sku-a-1', quantity: 1 }
    });
    expect(addRes.ok()).toBeTruthy();

    // 3. Create Checkout Session
    const sessionRes = await request.post(`${STOREFRONT_API_URL}/v1/storefront/checkout/sessions`, {
      headers: { Host: STORE_A_HOST, Cookie: cartCookieHeader }
    });
    expect(sessionRes.ok()).toBeTruthy();

    const sessionData = await sessionRes.json();
    const sessionCookieHeader = sessionRes.headers()['set-cookie'];

    // 4. Finalize Checkout
    const finalizeRes = await request.post(`${STOREFRONT_API_URL}/v1/storefront/checkout/sessions/${sessionData.id}/finalize`, {
      headers: { Host: STORE_A_HOST, Cookie: sessionCookieHeader },
      data: {
        shipping_address: {
          recipient_name: 'Test Buyer',
          address_line_1: '123 Main St',
          city: 'Cairo',
          country_code: 'EG'
        },
        contact_email: 'buyer@example.com'
      }
    });
    expect(finalizeRes.ok()).toBeTruthy();
    const orderData = await finalizeRes.json();

    const rawSetCookie = finalizeRes.headers()['set-cookie'] || '';
    const orderCookieHeader = rawSetCookie
      .split('\n')
      .map((c) => c.split(';')[0])
      .join('; ');

    // 5. Attempt to read Store A order on Store B Host
    const crossHostRes = await request.get(`${STOREFRONT_API_URL}/v1/storefront/orders/${orderData.id}`, {
      headers: { Host: STORE_B_HOST, Cookie: orderCookieHeader }
    });

    // Must be rejected (404 not found so cross-tenant existence is hidden)
    expect(crossHostRes.status()).toBe(404);
  });

  test('Response-Loss Replay: Retrying Finalize on same Session returns same Order', async ({ request }) => {
    // 1. Create Cart
    const cartRes = await request.post(`${STOREFRONT_API_URL}/v1/storefront/carts`, {
      headers: { Host: STORE_A_HOST }
    });
    const cartCookieHeader = cartRes.headers()['set-cookie'];

    // 2. Add Item
    await request.post(`${STOREFRONT_API_URL}/v1/storefront/carts/items`, {
      headers: { Host: STORE_A_HOST, Cookie: cartCookieHeader },
      data: { sku_id: 'sku-a-1', quantity: 1 }
    });

    // 3. Create Checkout Session
    const sessionRes = await request.post(`${STOREFRONT_API_URL}/v1/storefront/checkout/sessions`, {
      headers: { Host: STORE_A_HOST, Cookie: cartCookieHeader }
    });
    const sessionData = await sessionRes.json();
    const sessionCookieHeader = sessionRes.headers()['set-cookie'];

    const payload = {
      shipping_address: {
        recipient_name: 'Replay Buyer',
        address_line_1: '99 Replay Way',
        city: 'Cairo',
        country_code: 'EG'
      },
      contact_email: 'replay@example.com'
    };

    // 4. First Finalize
    const finalize1 = await request.post(`${STOREFRONT_API_URL}/v1/storefront/checkout/sessions/${sessionData.id}/finalize`, {
      headers: { Host: STORE_A_HOST, Cookie: sessionCookieHeader },
      data: payload
    });
    expect(finalize1.ok()).toBeTruthy();
    const order1 = await finalize1.json();

    // 5. Replay Finalize (simulating response loss)
    const finalize2 = await request.post(`${STOREFRONT_API_URL}/v1/storefront/checkout/sessions/${sessionData.id}/finalize`, {
      headers: { Host: STORE_A_HOST, Cookie: sessionCookieHeader },
      data: payload
    });
    expect(finalize2.ok()).toBeTruthy();
    const order2 = await finalize2.json();

    // Assert SAME Order ID and order_number
    expect(order2.id).toBe(order1.id);
    expect(order2.order_number).toBe(order1.order_number);
  });
});
