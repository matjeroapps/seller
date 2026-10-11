import { expect, test, type Page, type Route } from '@playwright/test';
import { serializeSessionCookie } from '../../web/seller/lib/auth/session-cookie';

const SELLER_APP_URL = process.env.SELLER_APP_URL || 'http://127.0.0.1:3001';

const STORE_ID = 'str_dev_01';
const PRODUCT_ID = 'prd_variants_e2e';
const PRODUCT_SLUG = 'variant-e2e-product';
const PRODUCT_NAME = 'Variant E2E Product';
const DETAIL_URL = `/api/seller/v1/seller/stores/${STORE_ID}/products/${PRODUCT_ID}`;
const VARIANT_API_PREFIX = `${DETAIL_URL}/variants`;
const NOW = '2026-01-01T00:00:00Z';

type AttributeValues = Array<{
  id: string;
  attribute_id: string;
  attribute_name: string;
  attribute_code: string;
  value_id: string;
  value_name: string;
  value_code: string;
}>;

interface SkuFixture {
  id: string;
  variant_id: string;
  code: string;
  barcode?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface VariantFixture {
  id: string;
  code: string;
  status: string;
  attribute_values: AttributeValues;
  sku?: SkuFixture;
  created_at: string;
  updated_at: string;
}

interface MockState {
  variants: VariantFixture[];
  skus: SkuFixture[];
  /** POST /variants payloads whose sku_code contains this fragment fail. */
  failSkuCodeFragment: string | null;
  createdVariantCodes: string[];
  archivedVariantIds: string[];
  removedVariantIds: string[];
  updatedVariantCodes: string[];
}

function skuFixture(variantId: string, code: string, status = 'active'): SkuFixture {
  return {
    id: `sku_${code.toLowerCase()}_${variantId}`,
    variant_id: variantId,
    code,
    status,
    created_at: NOW,
    updated_at: NOW
  };
}

function attributeValueDetail(
  attributeName: string,
  attributeCode: string,
  valueName: string,
  valueCode: string
): AttributeValues[number] {
  return {
    id: `av_${attributeCode}_${valueCode}`,
    attribute_id: `att_${attributeCode}`,
    attribute_name: attributeName,
    attribute_code: attributeCode,
    value_id: `val_${attributeCode}_${valueCode}`,
    value_name: valueName,
    value_code: valueCode
  };
}

function variantFixture(id: string, code: string, attributes: AttributeValues, withSku: boolean): VariantFixture {
  const variant: VariantFixture = {
    id,
    code,
    status: 'active',
    attribute_values: attributes,
    created_at: NOW,
    updated_at: NOW
  };
  if (withSku) variant.sku = skuFixture(id, `SKU-${code}`);
  return variant;
}

/** Builds a SellerProductDetail payload matching lib/api/types.ts. */
function productDetail(variants: VariantFixture[]) {
  return {
    product: {
      id: PRODUCT_ID,
      slug: PRODUCT_SLUG,
      status: 'active',
      created_at: NOW,
      updated_at: NOW
    },
    source: 'seller_owned',
    translations: [
      { locale: 'en', name: PRODUCT_NAME, description: 'Product used by product-variants E2E specs.' }
    ],
    category_ids: [],
    store_category_ids: [],
    store_categories: [],
    variants,
    skus: variants.flatMap((variant) => (variant.sku ? [variant.sku] : [])),
    media: [],
    listing: null,
    current_price: null,
    inventory_summary: { total_on_hand: 0, total_reserved: 0, total_available: 0, locations: [] },
    presentation: null,
    purchase_behavior: 'buy_now',
    publish_readiness: { is_ready: true, reasons: [] }
  };
}

function initialState(variants: VariantFixture[]): MockState {
  return {
    variants,
    skus: variants.flatMap((variant) => (variant.sku ? [variant.sku] : [])),
    failSkuCodeFragment: null,
    createdVariantCodes: [],
    archivedVariantIds: [],
    removedVariantIds: [],
    updatedVariantCodes: []
  };
}

const COLOR = { name: 'Color', code: 'color' };
const SIZE = { name: 'Size', code: 'size' };
const MATERIAL = { name: 'Material', code: 'material' };

const COLOR_VALUES = [
  { valueName: 'Red', valueCode: 'red' },
  { valueName: 'Blue', valueCode: 'blue' }
];
const SIZE_VALUES = [
  { valueName: 'S', valueCode: 's' },
  { valueName: 'M', valueCode: 'm' },
  { valueName: 'L', valueCode: 'l' }
];

function colorSizeDetail(): VariantFixture[] {
  // Two existing variants seed the Color/Size attribute dimensions. Their
  // exact two-value signatures match two of the six possible combinations, so
  // the preview shows six rows with two marked as existing and four createable.
  const first = variantFixture(
    'var_red_s',
    'SEED-RED-S',
    [attributeValueDetail(COLOR.name, COLOR.code, 'Red', 'red'), attributeValueDetail(SIZE.name, SIZE.code, 'S', 's')],
    false
  );
  const second = variantFixture(
    'var_blue_l',
    'SEED-BLUE-L',
    [attributeValueDetail(COLOR.name, COLOR.code, 'Blue', 'blue'), attributeValueDetail(SIZE.name, SIZE.code, 'L', 'l')],
    false
  );
  // A third variant carries the full value palette (including Size: M) in one
  // record, so every option is offered by the picker. Because its signature
  // mixes several values into one record it matches none of the six pair
  // combinations, keeping the existing count at exactly two.
  const palette = variantFixture(
    'var_palette',
    'SEED-PALETTE',
    [
      attributeValueDetail(COLOR.name, COLOR.code, 'Red', 'red'),
      attributeValueDetail(COLOR.name, COLOR.code, 'Blue', 'blue'),
      attributeValueDetail(SIZE.name, SIZE.code, 'S', 's'),
      attributeValueDetail(SIZE.name, SIZE.code, 'M', 'm'),
      attributeValueDetail(SIZE.name, SIZE.code, 'L', 'l')
    ],
    false
  );
  return [first, second, palette];
}

/** One variant carrying many attribute values is enough to expose picker options. */
function bigCombinatorialDetail(): VariantFixture[] {
  const colorValues = ['Red', 'Blue', 'Green', 'Black'].map((value, index) => ({
    valueName: value,
    valueCode: ['red', 'blue', 'green', 'black'][index]
  }));
  const sizeValues = ['S', 'M', 'L', 'XL'].map((value, index) => ({
    valueName: value,
    valueCode: ['s', 'm', 'l', 'xl'][index]
  }));
  const materialValues = Array.from({ length: 7 }, (_, index) => ({
    valueName: `Material ${index + 2}`,
    valueCode: `material-${index + 2}`
  }));
  const attributes: AttributeValues = [
    ...colorValues.map((value) => attributeValueDetail(COLOR.name, COLOR.code, value.valueName, value.valueCode)),
    ...sizeValues.map((value) => attributeValueDetail(SIZE.name, SIZE.code, value.valueName, value.valueCode)),
    ...materialValues.map((value) => attributeValueDetail(MATERIAL.name, MATERIAL.code, value.valueName, value.valueCode))
  ];
  return [variantFixture('var_seed_wide', 'SEED-WIDE', attributes, false)];
}

function defaultVariantDetail(): VariantFixture[] {
  return [variantFixture('var_default', 'default', [], true)];
}

function unreferencedVariant(): VariantFixture {
  return variantFixture('var_unref', 'UNREFERENCED-VAR', [], false);
}

function referencedVariant(): VariantFixture {
  return variantFixture('var_ref', 'REFERENCED-VAR', [], true);
}

async function installSellerApiMock(page: Page, state: MockState) {
  await page.route('**/api/seller/**', async (route: Route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (method === 'GET' && path === DETAIL_URL) {
      return json(productDetail(state.variants));
    }
    if (method === 'GET' && path === `${DETAIL_URL}/media-references`) {
      return json({ items: [] });
    }
    if (method === 'GET' && path.startsWith('/api/seller/v1/seller/stores/') && path.endsWith('/media')) {
      return json({ items: [], total: 0, limit: 50, offset: 0 });
    }
    if (method === 'GET' && path.startsWith('/api/seller/v1/seller/stores/') && path.endsWith('/categories')) {
      return json([]);
    }
    if (method === 'POST' && path === VARIANT_API_PREFIX) {
      const body = request.postDataJSON();
      state.createdVariantCodes.push(body.code);
      if (state.failSkuCodeFragment && String(body.sku_code || '').includes(state.failSkuCodeFragment)) {
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { code: 'conflict', message: `SKU code ${body.sku_code} is already in use for this store.` }
          })
        });
      }
      return json(
        variantFixture(
          `var_created_${state.createdVariantCodes.length}`,
          body.code,
          [],
          Boolean(body.sku_code)
        ),
        201
      );
    }
    if (method === 'POST' &&
      /^\/api\/seller\/v1\/seller\/stores\/[^/]+\/products\/[^/]+\/variants\/[^/]+\/archive$/.test(path)) {
      const variantId = path.split('/')[path.split('/').length - 2];
      const variant = state.variants.find((candidate) => candidate.id === variantId);
      expect(variant, `archived variant ${variantId} exists`).toBeDefined();
      variant!.status = 'archived';
      variant!.updated_at = NOW;
      state.archivedVariantIds.push(variantId);
      for (const sku of state.skus.filter((candidate) => candidate.variant_id === variantId)) {
        sku.status = 'inactive';
        sku.updated_at = NOW;
      }
      return json(variant);
    }
    if (method === 'PUT' &&
      /^\/api\/seller\/v1\/seller\/stores\/[^/]+\/products\/[^/]+\/variants\/[^/]+$/.test(path)) {
      const variantId = path.split('/').pop()!;
      const variant = state.variants.find((candidate) => candidate.id === variantId);
      if (!variant) {
        return json({ error: { code: 'not_found', message: 'Variant not found.' } }, 404);
      }
      const body = request.postDataJSON();
      variant.code = body.code;
      variant.status = body.status;
      variant.updated_at = NOW;
      state.updatedVariantCodes.push(body.code);
      return json(variant);
    }
    if (method === 'DELETE' &&
      /^\/api\/seller\/v1\/seller\/stores\/[^/]+\/products\/[^/]+\/variants\/[^/]+$/.test(path)) {
      const variantId = path.split('/').pop()!;
      state.removedVariantIds.push(variantId);
      state.variants = state.variants.filter((candidate) => candidate.id !== variantId);
      state.skus = state.skus.filter((candidate) => candidate.variant_id !== variantId);
      return route.fulfill({ status: 204 });
    }
    if (method === 'POST' && path === `${DETAIL_URL}/status`) {
      return json({ status: request.postDataJSON().status });
    }
    return json({ error: { code: 'not_mocked', message: `No mock for ${method} ${path}` } }, 404);
  });
}

async function openProductPage(page: Page, state: MockState) {
  await installSellerApiMock(page, state);
  await page.goto(`${SELLER_APP_URL}/dashboard/stores/${STORE_ID}/catalog/products/${PRODUCT_ID}`);
  await expect(page.getByRole('heading', { name: PRODUCT_NAME })).toBeVisible();
}

function previewDialog(page: Page) {
  return page.getByRole('dialog');
}

function previewRows(page: Page) {
  return previewDialog(page).getByTestId('variant-preview-table').locator('tbody tr');
}

/**
 * The detail card for one existing variant, identified by its Delete button
 * (aria-label `Delete variant <code>`) and scoped to the closest card
 * container. All on-page variant controls are then resolved relative to it.
 */
function variantCard(page: Page, code: string) {
  return page
    .getByRole('button', { name: `Delete variant ${code}` })
    .locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
}

function variantCodeInput(page: Page, code: string) {
  // Variant code is the first textbox inside the card (before SKU editors).
  return variantCard(page, code).getByRole('textbox').first();
}

function variantStatusSelect(page: Page, code: string) {
  // Variant status select, then per-SKU selects, then the new-SKU draft select.
  return variantCard(page, code).getByRole('combobox').first();
}

function skuStatusSelect(page: Page, code: string) {
  return variantCard(page, code).getByRole('combobox').nth(1);
}

function skuCodeInput(page: Page, code: string) {
  // Per-SKU table: SKU code textbox, then barcode textbox.
  return variantCard(page, code).getByRole('textbox').nth(1);
}

interface DimensionOptions {
  attributes: Array<{ name: string; values: string[] }>;
}

async function selectAllDimensions(dialog: ReturnType<Page['getByRole']>, options: DimensionOptions) {
  for (const attribute of options.attributes) {
    await dialog.getByLabel(`Use ${attribute.name}`).check();
    for (const value of attribute.values) {
      await dialog.getByLabel(`${attribute.name}: ${value}`).check();
    }
  }
}

function colorSizeDimensionOptions(): DimensionOptions {
  return {
    attributes: [
      { name: COLOR.name, values: COLOR_VALUES.map((value) => value.valueName) },
      { name: SIZE.name, values: SIZE_VALUES.map((value) => value.valueName) }
    ]
  };
}

test.describe('Product Variant Management E2E', () => {
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

  test('2 color values x 3 size values yields exactly six preview rows', async ({ page }) => {
    await openProductPage(page, initialState(colorSizeDetail()));

    await page.getByRole('button', { name: /Configure Variant & Specs/ }).click();
    const dialog = previewDialog(page);
    await expect(dialog.getByText('Select attribute values to preview variant combinations')).toBeVisible();

    await selectAllDimensions(dialog, colorSizeDimensionOptions());

    // 2 colors x 3 sizes = 6 distinct combinations, all rendered as rows.
    await expect(dialog.getByText('6 combinations')).toBeVisible();
    await expect(previewRows(page)).toHaveCount(6);
    // Existing signatures of the seeded variants are flagged, the rest are new.
    await expect(dialog.getByText('exists', { exact: true })).toHaveCount(2);
  });

  test('variant and SKU codes are editable and used on creation', async ({ page }) => {
    const state = initialState(colorSizeDetail());
    await openProductPage(page, state);

    await page.getByRole('button', { name: /Configure Variant & Specs/ }).click();
    const dialog = previewDialog(page);
    await selectAllDimensions(dialog, colorSizeDimensionOptions());
    await expect(dialog.getByText('6 combinations')).toBeVisible();

    // Rows render in (Color blue→red, Size L→M→S) order: the first rows are
    // the existing Blue-L and then the createable Blue-M combination.
    const blueMRow = previewRows(page).filter({ hasText: 'Color: Blue' }).filter({ hasText: 'Size: M' });
    await expect(blueMRow).toHaveCount(1);
    const variantCodeInput = blueMRow.getByLabel(/^Variant code for Blue\/M/);
    const skuCodeInput = blueMRow.getByLabel(/^SKU code for /);
    const generatedVariantCode = await variantCodeInput.inputValue();
    const generatedSkuCode = await skuCodeInput.inputValue();
    // Generated codes come from the product slug plus the value codes, unique
    // against the seeded variant/SKU codes.
    expect(generatedVariantCode).toBe(`${PRODUCT_SLUG.toUpperCase()}-BLUE-M`);
    expect(generatedSkuCode).toBe(`SKU-${generatedVariantCode}`);

    await variantCodeInput.fill('MERCHANT-EDITED-VAR');
    await skuCodeInput.fill('SKU-MERCHANT-EDITED');

    await dialog.getByRole('button', { name: /Create 4 variants/ }).click();
    await expect.poll(() => state.createdVariantCodes.length).toBe(4);
    // Only the non-existing rows are POSTed; the two existing rows are skipped.
    expect(state.createdVariantCodes).toContain('MERCHANT-EDITED-VAR');
  });

  test('removing a preview row skips it from batch creation', async ({ page }) => {
    const state = initialState(colorSizeDetail());
    await openProductPage(page, state);

    await page.getByRole('button', { name: /Configure Variant & Specs/ }).click();
    const dialog = previewDialog(page);
    await selectAllDimensions(dialog, colorSizeDimensionOptions());
    await expect(dialog.getByRole('button', { name: /Create 4 variants/ })).toBeVisible();

    // Remove the Blue-M row: the first createable (non-existing) combination.
    // Removing an existing row would not change the creation count because
    // existing rows are skipped from the batch anyway.
    const blueMRow = previewRows(page).filter({ hasText: 'Color: Blue' }).filter({ hasText: 'Size: M' });
    await expect(blueMRow).toHaveCount(1);
    await blueMRow.getByRole('button', { name: /^Remove / }).click();
    // Row stays for review, collapsed to the removed state.
    await expect(blueMRow).toHaveClass(/opacity-50/);
    await expect(blueMRow.getByText('removed', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Create 3 variants/ })).toBeVisible();

    await dialog.getByRole('button', { name: /Create 3 variants/ }).click();
    await expect.poll(() => state.createdVariantCodes.length).toBe(3);
  });

  test('more than 100 combinations is rejected before save', async ({ page }) => {
    const state = initialState(bigCombinatorialDetail());
    await openProductPage(page, state);

    await page.getByRole('button', { name: /Configure Variant & Specs/ }).click();
    const dialog = previewDialog(page);
    const errors = dialog.getByTestId('variant-preview-errors');
    await selectAllDimensions(dialog, {
      attributes: [
        { name: COLOR.name, values: ['Red', 'Blue', 'Green', 'Black'] },
        { name: SIZE.name, values: ['S', 'M', 'L', 'XL'] },
        { name: MATERIAL.name, values: ['Material 2', 'Material 3'] }
      ]
    });

    // 4 x 4 x 2 = 32; grow toward but stay under the 100 limit.
    for (const materialValue of ['Material 4', 'Material 5', 'Material 6', 'Material 7']) {
      await dialog.getByLabel(`Material: ${materialValue}`).check();
    }

    // 4 x 4 x 6 = 96 combinations is still allowed within the cap.
    await expect(dialog.getByText('96 combinations')).toBeVisible();
    await expect(errors).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: /Create 96 variants/ })).toBeEnabled();

    // The eighth material pushes the selection to 4 x 4 x 7 = 112 > 100, so
    // validation blocks creation before any save request is made.
    await dialog.getByLabel('Material: Material 8').check();
    await expect(errors).toBeVisible();
    await expect(errors.getByText(/Selection creates \d+ combinations\./)).toHaveText(
      /Selection creates 112 combinations\./
    );
    await expect(dialog.getByRole('button', { name: /Create .* variants/ })).toBeDisabled();
    expect(state.createdVariantCodes).toHaveLength(0);
  });

  test('mixed batch result keeps failed row and retry recreates failed rows only', async ({ page }) => {
    const state = initialState(colorSizeDetail());
    state.failSkuCodeFragment = 'RED-M';
    await openProductPage(page, state);

    await page.getByRole('button', { name: /Configure Variant & Specs/ }).click();
    const dialog = previewDialog(page);
    await selectAllDimensions(dialog, colorSizeDimensionOptions());
    await dialog.getByRole('button', { name: /Create 4 variants/ }).click();

    // Mixed result: three rows created, the conflicting SKU row failed.
    const failedRow = previewRows(page).filter({ hasText: 'is already in use' });
    await expect(failedRow).toHaveCount(1);
    // The failed row's status cell shows 'Failed' plus the API error message.
    await expect(failedRow.filter({ hasText: 'Failed:' })).toHaveCount(1);
    const createdRows = previewRows(page).filter({ hasText: 'Created' });
    await expect(createdRows).toHaveCount(3);
    // The API mock logs every POST before applying the conflict rule, so the
    // four createable rows were all posted, and exactly one (SKUs clashing on
    // RED-M) was rejected.
    const FAILED_ROW_CODE = 'VARIANT-E2E-PRODUCT-RED-M';
    expect(state.createdVariantCodes).toHaveLength(4);
    expect(state.createdVariantCodes).toContain(FAILED_ROW_CODE);

    state.failSkuCodeFragment = null;
    await dialog.getByRole('button', { name: /Retry 1 failed/ }).click();
    // Retry only re-POSTed the failed row's codes; no successful variant duplicated.
    await expect.poll(() => state.createdVariantCodes.length).toBe(5);
    expect(state.createdVariantCodes.filter((code) => code !== FAILED_ROW_CODE)).toEqual([
      'VARIANT-E2E-PRODUCT-BLUE-M',
      'VARIANT-E2E-PRODUCT-BLUE-S',
      'VARIANT-E2E-PRODUCT-RED-L'
    ]);
    // The one remaining duplicate is the failed row being retried exactly once.
    expect(state.createdVariantCodes.filter((code) => code === FAILED_ROW_CODE)).toHaveLength(2);
    await expect(dialog.getByRole('button', { name: /Retry \d+ failed/ })).toHaveCount(0);
    await expect(createdRows).toHaveCount(4);
  });

  test('unreferenced variant edit survives reload', async ({ page }) => {
    const state = initialState([unreferencedVariant()]);
    await openProductPage(page, state);

    const codeInput = variantCodeInput(page, 'UNREFERENCED-VAR');
    await expect(codeInput).toHaveValue('UNREFERENCED-VAR');
    await codeInput.fill('RENAMED-VARIANT');
    await page.getByRole('button', { name: 'Save Variant' }).click();

    await expect.poll(() => state.updatedVariantCodes).toEqual(['RENAMED-VARIANT']);
    await page.reload();
    await expect(variantCodeInput(page, 'RENAMED-VARIANT')).toHaveValue('RENAMED-VARIANT');
    await expect(page.getByRole('button', { name: 'Delete variant UNREFERENCED-VAR' })).toHaveCount(0);
  });

  test('referenced variant cannot be removed and archive guidance is offered', async ({ page }) => {
    await openProductPage(page, initialState([referencedVariant()]));

    const removeButton = page.getByLabel('Delete variant REFERENCED-VAR');
    await expect(removeButton).toBeDisabled();

    const guidance = page.getByText(/referenced by \d+ SKU/);
    await expect(guidance).toHaveCount(1);
    await expect(guidance).toContainText('permanent removal is blocked');
    await expect(guidance).toContainText('Archive it instead');

    await page.getByLabel('Deactivate variant REFERENCED-VAR').click();
    const confirmDialog = previewDialog(page);
    await expect(
      confirmDialog.getByText(/Archive variant REFERENCED-VAR\? Its active SKUs will be deactivated/)
    ).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirmDialog).toHaveCount(0);
  });

  test('archive deactivates the active SKU while historical records remain', async ({ page }) => {
    const state = initialState([referencedVariant()]);
    await openProductPage(page, state);

    await page.getByLabel('Deactivate variant REFERENCED-VAR').click();
    const confirmDialog = previewDialog(page);
    await confirmDialog.getByRole('button', { name: 'Archive Variant' }).click();

    await expect(state.archivedVariantIds).toContain('var_ref');
    await expect(page.getByText('Variant archived and its active SKU was deactivated.')).toBeVisible();

    // Reload: the variant still exists (history preserved) in archived state,
    // and its SKU row is inactive instead of deleted.
    await page.reload();
    const archivedCard = variantCard(page, 'REFERENCED-VAR');
    await expect(variantCodeInput(page, 'REFERENCED-VAR')).toHaveValue('REFERENCED-VAR');
    await expect(variantStatusSelect(page, 'REFERENCED-VAR')).toHaveValue('archived');
    await expect(skuStatusSelect(page, 'REFERENCED-VAR')).toHaveValue('inactive');
    await expect(skuCodeInput(page, 'REFERENCED-VAR')).toHaveValue('SKU-REFERENCED-VAR');
  });

  test('default-variant workflow remains available for products without configurable attributes', async ({ page }) => {
    const state = initialState(defaultVariantDetail());
    await openProductPage(page, state);

    // The existing single default variant is still manageable directly.
    await expect(variantCodeInput(page, 'default')).toHaveValue('default');

    await page.getByRole('button', { name: /Configure Variant & Specs/ }).click();
    const dialog = previewDialog(page);
    // With no variant attribute data the spec-based single-variant form opens
    // (not the batch preview).
    await expect(dialog.getByText('Configure option dimensions, SKU barcode')).toBeVisible();
    await expect(dialog.getByTestId('variant-attribute-picker')).toHaveCount(0);

    await dialog.getByPlaceholder('e.g. red-xl').fill('default-extra');
    await dialog.getByPlaceholder('e.g. SKU-RED-XL').fill('SKU-DEFAULT-EXTRA');
    await dialog.getByRole('button', { name: /Create Variant with Specs/ }).click();

    await expect.poll(() => state.createdVariantCodes).toContain('default-extra');
  });

  test('unreferenced variant removal issues DELETE and the refreshed page shows absence', async ({ page }) => {
    const state = initialState([unreferencedVariant()]);
    await openProductPage(page, state);

    // An unreferenced variant (no SKUs, no operational history) is the only
    // removable kind; its Remove control must be enabled.
    const removeButton = page.getByLabel('Delete variant UNREFERENCED-VAR');
    await expect(removeButton).toBeEnabled();
    await removeButton.click();

    const confirmDialog = previewDialog(page);
    await expect(confirmDialog.getByText(/Permanently remove variant UNREFERENCED-VAR\?/)).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Remove Variant' }).click();

    // The removal reached the Seller API as a DELETE against the variant route.
    await expect.poll(() => state.removedVariantIds).toContain('var_unref');

    // Reload shows the variant is gone: no card, no editors, no stale code.
    await page.reload();
    await expect(page.getByText('No variants yet.')).toBeVisible();
    await expect(page.getByLabel('Delete variant UNREFERENCED-VAR')).toHaveCount(0);
    await expect(page.getByLabel('Deactivate variant UNREFERENCED-VAR')).toHaveCount(0);
    await expect(page.getByText('UNREFERENCED-VAR')).toHaveCount(0);
  });
});
