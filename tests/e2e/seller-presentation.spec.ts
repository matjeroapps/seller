import { test, expect } from '@playwright/test';
import { STORE_A_BASE_URL, FAKE_CORE_CONTROL_URL } from './support/fixtures';

// P5.8 companion spec: structured product page sections end to end.
//
// Companion to seller-flagship.spec.ts (which stays focused on the full
// authoring → fulfillment timeline). This spec authors a product with ALL SIX
// structured section types through the seller UI — description, highlights,
// image_text (selecting a real uploaded product image + a global layout),
// specifications, faq and final_cta (with a global action) — publishes it, and
// asserts the public projection renders correctly in EN and AR on the
// storefront, with no raw JSON leaking into the page.

const SELLER_APP_URL = process.env.SELLER_APP_URL || 'http://127.0.0.1:5173';
const SELLER_SUBJECT = process.env.SELLER_E2E_SUBJECT || 'usr_seller_dev';
const PRESENTATION_SLUG = `presentation-${Date.now()}`;

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

test('P5.8 presentation: all six structured sections render in EN and AR', async ({ page }) => {
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

  // --- SELLER: author the product through general → media → pricing ---
  await page.goto(`${SELLER_APP_URL}/#/products`);
  await expect(page.locator('button:has-text("New Product")')).toBeVisible({ timeout: 30_000 });

  await page.click('button:has-text("New Product")');
  await page.fill('#prod-slug', PRESENTATION_SLUG);
  await page.fill('#name-en', 'Presentation Product');
  await page.fill('#desc-en', 'A product authored to exercise every structured section.');
  await page.fill('#name-ar', 'منتج العرض');
  await page.fill('#desc-ar', 'منتج لتجربة كل أقسام الصفحة.');
  await page.click('button:has-text("Save & Next: Variants")');

  await page.fill('#v-code', 'default');
  await page.fill('#sku-code', 'SKU-PRESENTATION-1');
  await page.click('button:has-text("Save & Next: Media Upload")');

  // One real uploaded image, referenced later by the image_text section.
  await page.setInputFiles('input[type="file"]', {
    name: 'section-photo.png',
    mimeType: 'image/png',
    buffer: PNG_BYTES,
  });
  await expect(page.locator('.media-card').first()).toBeVisible({ timeout: 30_000 });

  await page.click('button:has-text("Next: Price & Inventory")');
  await page.fill('#price-input', '120.00');
  await page.fill('#stock-input', '12');
  await page.click('button:has-text("Save & Next: Product Page Editor")');

  // --- SELLER: add all six section types ---
  const addSectionOfType = async (label: string) => {
    await page.selectOption('.section-actions select[aria-label="New section type"]', { label });
    await page.click('.section-actions button:has-text("+ Add Section")');
  };

  // 1. description — EN + AR heading/body.
  await addSectionOfType('Description');
  const description = page.locator('.section-box', { hasText: 'Description' }).first();
  await description.locator('input.form-control').nth(0).fill('About the craft');
  await description.locator('textarea.form-control').nth(0).fill('Handmade with care in EN.');
  await description.locator('input.form-control').nth(1).fill('عن الصنعة');
  await description.locator('textarea.form-control').nth(1).fill('صنع يدوي بعناية.');

  // 2. highlights — EN + AR title and items (one per line).
  await addSectionOfType('Highlights');
  const highlights = page.locator('.section-box', { hasText: 'Highlights' }).first();
  await highlights.locator('input.form-control').nth(0).fill('Why choose it');
  await highlights.locator('textarea.form-control').nth(0).fill('Durable build\nFair price');
  await highlights.locator('input.form-control').nth(1).fill('لماذا تختاره');
  await highlights.locator('textarea.form-control').nth(1).fill('بناء متين\nسعر عادل');

  // 3. image_text — GLOBAL image (one of the uploaded product images) and
  //    GLOBAL layout; localized heading/body per locale.
  await addSectionOfType('Image & Text');
  const imageText = page.locator('.section-box', { hasText: 'Image & Text' }).first();
  await imageText.locator('select[aria-label="Section image"]').selectOption({ label: 'section-photo' });
  await imageText.locator('select[aria-label="Image layout"]').selectOption('right');
  await imageText.locator('input.form-control').nth(0).fill('See it in place');
  await imageText.locator('textarea.form-control').nth(0).fill('The photo is the uploaded product image.');
  await imageText.locator('input.form-control').nth(1).fill('شاهدها في مكانها');
  await imageText.locator('textarea.form-control').nth(1).fill('الصورة هي صورة المنتج المرفوعة.');

  // 4. specifications — EN + AR key/value rows.
  await addSectionOfType('Specifications');
  const specifications = page.locator('.section-box', { hasText: 'Specifications' }).first();
  await specifications.locator('.spec-row input[type="text"]').nth(0).fill('Material');
  await specifications.locator('.spec-row input[type="text"]').nth(1).fill('Solid oak');
  await specifications.locator('.spec-row input[type="text"]').nth(2).fill('الخامة');
  await specifications.locator('.spec-row input[type="text"]').nth(3).fill('خشب البلوط');

  // 5. faq — EN + AR question/answer rows.
  await addSectionOfType('FAQ');
  const faq = page.locator('.section-box', { hasText: 'FAQ' }).first();
  await faq.locator('.faq-row input[type="text"]').nth(0).fill('How long does shipping take?');
  await faq.locator('.faq-row textarea').nth(0).fill('Two to four business days.');
  await faq.locator('.faq-row input[type="text"]').nth(1).fill('كم تستغرق الشحن؟');
  await faq.locator('.faq-row textarea').nth(1).fill('من يومين إلى أربعة أيام عمل.');

  // 6. final_cta — GLOBAL action (add_to_cart), localized title/body only.
  await addSectionOfType('Final Call-to-Action');
  const finalCta = page.locator('.section-box', { hasText: 'Final Call-to-Action' }).first();
  await finalCta.locator('select[aria-label="Call-to-action action"]').selectOption('add_to_cart');
  await finalCta.locator('input.form-control').nth(0).fill('Bring one home');
  await finalCta.locator('textarea.form-control').nth(0).fill('Free returns within 30 days.');
  await finalCta.locator('input.form-control').nth(1).fill('احضر واحداً إلى المنزل');
  await finalCta.locator('textarea.form-control').nth(1).fill('إرجاع مجاني خلال ٣٠ يوماً.');

  await page.click('button:has-text("Save & Next: Readiness & Publish")');
  await expect(page.locator('button:has-text("Publish Product")')).toBeEnabled({ timeout: 15_000 });
  await page.click('button:has-text("Publish Product")');
  await expect(page.locator('table, .products-list, .list-view').first()).toBeVisible({ timeout: 15_000 });

  // --- CUSTOMER STOREFRONT: EN page renders every section ---
  await page.goto(`${STORE_A_BASE_URL}/en/products/${PRESENTATION_SLUG}`);
  await expect(page.locator('.product__title')).toContainText('Presentation Product', { timeout: 30_000 });

  // description
  const descriptionSection = page.locator('.product-page-section--description');
  await expect(descriptionSection.locator('h2')).toHaveText('About the craft');
  await expect(descriptionSection.locator('p')).toHaveText('Handmade with care in EN.');

  // highlights
  const highlightsSection = page.locator('.product-page-section--highlights');
  await expect(highlightsSection.locator('h2')).toHaveText('Why choose it');
  await expect(highlightsSection.locator('li')).toHaveCount(2);
  await expect(highlightsSection.locator('li').first()).toHaveText('Durable build');

  // image_text — the uploaded product image, projected uri/alt, right layout.
  const imageTextSection = page.locator('.product-page-section--image_text');
  await expect(imageTextSection.locator('img')).toHaveAttribute('alt', 'section-photo');
  await expect(imageTextSection.locator('img')).toHaveAttribute('src', /.+/);
  await expect(imageTextSection.locator('.product-page-section__image-text')).toHaveClass(
    /product-page-section__image-text--right/,
  );
  await expect(imageTextSection.locator('h2')).toHaveText('See it in place');

  // specifications
  const specsSection = page.locator('.product-page-section--specifications');
  await expect(specsSection.locator('dt')).toHaveText('Material');
  await expect(specsSection.locator('dd')).toHaveText('Solid oak');

  // faq
  const faqSection = page.locator('.product-page-section--faq');
  await expect(faqSection.locator('h3')).toHaveText('How long does shipping take?');
  await expect(faqSection.locator('p')).toHaveText('Two to four business days.');

  // final_cta — global add_to_cart action, CTA hands off to the purchase control.
  const ctaSection = page.locator('.product-page-section--final_cta');
  await expect(ctaSection.locator('h2')).toHaveText('Bring one home');
  await expect(ctaSection.locator('a')).toHaveAttribute('href', '#purchase-control');

  // No raw JSON or object dumps anywhere on the page.
  const enBody = await page.locator('body').innerText();
  expect(enBody).not.toContain('[object Object]');
  expect(enBody).not.toContain('{"');

  // --- CUSTOMER STOREFRONT: AR page shows the Arabic projection ---
  await page.goto(`${STORE_A_BASE_URL}/ar/products/${PRESENTATION_SLUG}`);
  await expect(page.locator('.product__title')).toBeVisible({ timeout: 30_000 });
  // Note: the public projection locale-projects section content; the product
  // name itself is served per Core's storefront product shape and is not
  // asserted here.

  await expect(page.locator('.product-page-section--description h2')).toHaveText('عن الصنعة');
  await expect(page.locator('.product-page-section--highlights h2')).toHaveText('لماذا تختاره');
  await expect(page.locator('.product-page-section--highlights li').first()).toHaveText('بناء متين');
  await expect(page.locator('.product-page-section--specifications dt')).toHaveText('الخامة');
  await expect(page.locator('.product-page-section--faq h3')).toHaveText('كم تستغرق الشحن؟');
  await expect(page.locator('.product-page-section--final_cta h2')).toHaveText('احضر واحداً إلى المنزل');

  // The image_text section renders the SAME uploaded product image in AR.
  const arImageText = page.locator('.product-page-section--image_text');
  await expect(arImageText.locator('img')).toHaveAttribute('alt', 'section-photo');
  await expect(arImageText.locator('h2')).toHaveText('شاهدها في مكانها');

  const arBody = await page.locator('body').innerText();
  expect(arBody).not.toContain('[object Object]');
  expect(arBody).not.toContain('{"');
});
