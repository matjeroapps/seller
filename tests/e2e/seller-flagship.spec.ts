import { test, expect } from '@playwright/test';
import { STORE_A_BASE_URL, FAKE_CORE_CONTROL_URL } from './support/fixtures';

// P5.8 Flagship E2E: the first live store.
//
// SELLER: login → pick store → author a product (EN/AR, category, variant,
// SKU, REAL image upload through a presigned PUT to S3-compatible storage,
// complete with verification, media management) → price → inventory →
// structured page sections → publish.
// CUSTOMER: storefront product page (primary image, price, EN/AR content,
// sections, availability, CTA) → purchase → checkout → order.
// SELLER ORDERS: order visible → detail → confirm → processing →
// ready_for_shipping.

const SELLER_APP_URL = process.env.SELLER_APP_URL || 'http://127.0.0.1:5173';
const SELLER_SUBJECT = process.env.SELLER_E2E_SUBJECT || 'usr_seller_dev';
const FLAGSHIP_SLUG = `flagship-${Date.now()}`;

async function mintSellerToken(): Promise<string> {
  const res = await fetch(`${FAKE_CORE_CONTROL_URL}/test-control/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: SELLER_SUBJECT }),
  });
  if (!res.ok) {
    throw new Error(`failed to mint seller token: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

// A real 1x1 PNG, uploaded as actual bytes through the presigned URL.
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test('P5.8 flagship: first live product from authoring to fulfillment', async ({ page }) => {
  test.setTimeout(180_000);

  const token = await mintSellerToken();
  await page.addInitScript(
    ({ t, subject }) => {
      sessionStorage.setItem('matjero_dev_token', t);
      sessionStorage.setItem(
        'matjero_dev_user',
        JSON.stringify({
          subject,
          preferred_username: 'seller_e2e',
          email: 'seller-e2e@matjero.test',
          roles: ['seller'],
        }),
      );
    },
    { t: token, subject: SELLER_SUBJECT },
  );

  // --- SELLER: products panel, store auto-selected ---
  await page.goto(`${SELLER_APP_URL}/#/products`);
  await expect(page.locator('button:has-text("New Product")')).toBeVisible({ timeout: 30_000 });

  await page.click('button:has-text("New Product")');

  // General: EN + AR data and a category when the picker has data.
  await page.fill('#prod-slug', FLAGSHIP_SLUG);
  await page.fill('#name-en', 'Flagship Product');
  await page.fill('#desc-en', 'Authored end to end by the P5.8 flagship E2E.');
  await page.fill('#name-ar', 'منتج رئيسي');
  await page.fill('#desc-ar', 'منتج من اختبار P5.8.');
  const categoryCheckbox = page.locator('.category-option input[type="checkbox"]').first();
  if ((await categoryCheckbox.count()) > 0) {
    await categoryCheckbox.check();
  }
  await page.click('button:has-text("Save & Next: Variants")');

  // Variant + SKU
  await page.fill('#v-code', 'default');
  await page.fill('#sku-code', 'SKU-FLAGSHIP-1');
  await page.click('button:has-text("Save & Next: Media Upload")');

  // Media: upload two REAL image files (presign → real PUT → complete).
  await page.setInputFiles('input[type="file"]', {
    name: 'front.png',
    mimeType: 'image/png',
    buffer: PNG_BYTES,
  });
  await expect(page.locator('.media-card').first()).toBeVisible({ timeout: 30_000 });
  await page.setInputFiles('input[type="file"]', {
    name: 'back.png',
    mimeType: 'image/png',
    buffer: PNG_BYTES,
  });
  await expect(page.locator('.media-card')).toHaveCount(2, { timeout: 30_000 });

  // Media management: identify the "back" card by its thumbnail alt text
  // (derived from the uploaded file name), make it primary and rename its alt
  // text; the storefront must then show it as the primary image.
  const backCard = page.locator('.media-card', { has: page.locator('img.media-thumb[alt="back"]') });
  await expect(backCard).toHaveCount(1);
  await backCard.locator('button:has-text("Set Primary")').click();
  await expect(backCard.locator('.badge-primary')).toBeVisible({ timeout: 15_000 });
  await backCard.locator('input[type="text"]').first().fill('Flagship back view');
  await backCard.locator('button:has-text("Save Alt Text")').click();
  // The alt edit is reflected after the detail refetch (also asserted on the
  // storefront below).

  await page.click('button:has-text("Next: Price & Inventory")');

  // Pricing + inventory in the Store currency (EGP, 2 decimals).
  await page.fill('#price-input', '250.00');
  await page.fill('#stock-input', '25');
  await page.click('button:has-text("Save & Next: Product Page Editor")');

  // Structured page: EN/AR description section, then save.
  await page.click('button:has-text("+ Add Section")');
  const descriptionSection = page.locator('.section-box', { hasText: 'Description' }).first();
  await descriptionSection.locator('input.form-control').first().fill('About'); // Heading (EN)
  await descriptionSection.locator('textarea.form-control').first().fill('Authored EN body'); // Body (EN)
  await descriptionSection.locator('input.form-control').nth(1).fill('نبذة'); // Heading (AR)
  await descriptionSection.locator('textarea.form-control').nth(1).fill('نص عربي'); // Body (AR)
  await page.click('button:has-text("Save & Next: Readiness & Publish")');

  // Publish: readiness checklist must be green before the button enables.
  await expect(page.locator('button:has-text("Publish Product")')).toBeEnabled({ timeout: 15_000 });
  await page.click('button:has-text("Publish Product")');
  // Publish returns to the list view.
  await expect(page.locator('table, .products-list, .list-view').first()).toBeVisible({ timeout: 15_000 });

  // --- CUSTOMER STOREFRONT ---
  await page.goto(`${STORE_A_BASE_URL}/en/products/${FLAGSHIP_SLUG}`);
  await expect(page.locator('.product__title')).toContainText('Flagship Product', { timeout: 30_000 });
  // Primary image is the one we set primary (identified by its alt text).
  await expect(page.locator('.product__image').first()).toHaveAttribute('alt', 'Flagship back view', { timeout: 15_000 });
  // Price in the store currency.
  await expect(page.locator('.product__price, .price')).toContainText('250.00');
  // Arabic content reachable via locale switch is covered by locale specs;
  // here the EN content and availability/CTA must be correct.
  await expect(page.locator('.add-to-cart-btn')).toBeVisible();

  // Purchase → checkout → order.
  await page.click('.add-to-cart-btn');
  await expect(page.locator('.purchase-control__success')).toBeVisible();
  await page.goto(`${STORE_A_BASE_URL}/en/cart`);
  await page.click('button:has-text("Proceed to Checkout")');
  await page.fill('#recipientName', 'Flagship Buyer');
  await page.fill('#contactEmail', 'flagship-buyer@matjero.test');
  await page.fill('#addressLine1', '1 Flagship Way');
  await page.fill('#city', 'Cairo');
  await page.fill('#countryCode', 'EG');
  await page.click('.checkout-form button[type="submit"]');
  await expect(page).toHaveURL(/\/en\/orders\/.+/, { timeout: 30_000 });
  await expect(page.locator('.order-status')).toContainText('Pending');

  // --- SELLER ORDERS: real timeline, contact email, allowed_next_actions ---
  await page.goto(`${SELLER_APP_URL}/#/orders`);
  await expect(page.locator('.orders-panel')).toBeVisible({ timeout: 30_000 });
  // Target the flagship order by its total (250.00 from the authored price);
  // the seeded historical orders have different totals.
  const flagshipRow = page.locator('table.data-table tbody tr', { hasText: '250.00' }).first();
  await expect(flagshipRow).toBeVisible({ timeout: 15_000 });
  await flagshipRow.locator('button').first().click();

  await expect(page.locator('.order-detail-view')).toBeVisible();
  await expect(page.locator('.order-detail-view')).toContainText('flagship-buyer@matjero.test');
  await expect(page.locator('.timeline-list li').first()).toBeVisible();

  // pending → confirmed → processing → ready_for_shipping, driven by
  // allowed_next_actions.
  await page.click('button:has-text("Confirm")');
  await expect(page.locator('.order-detail-view .status-badge')).toContainText('confirmed');
  await page.click('button:has-text("Start Processing")');
  await expect(page.locator('.order-detail-view .status-badge')).toContainText('processing');
  await page.click('button:has-text("Mark Ready for Shipping")');
  await expect(page.locator('.order-detail-view .status-badge')).toContainText('ready_for_shipping');
});
