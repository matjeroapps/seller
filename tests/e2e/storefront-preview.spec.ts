import { test, expect } from '@playwright/test';
import {
  STORE_A_BASE_URL,
  STORE_B_BASE_URL,
  resetFakeCore,
} from './support/fixtures';

test.beforeEach(async () => {
  await resetFakeCore();
});

test.describe('Storefront Preview Cache Safety & Authorization', () => {
  test('Public Store A request returns published theme', async ({ page }) => {
    await page.goto(`${STORE_A_BASE_URL}/en`);
    const content = await page.content();
    expect(content).toContain('STORE_A_THEME_MARKER');
    expect(content).not.toContain('STORE_A_DRAFT_MARKER');
  });

  test('Valid preview token on Store A exposes draft theme', async ({ page }) => {
    await page.goto(`${STORE_A_BASE_URL}/en?theme_preview=valid-preview-token-store-a`);
    const content = await page.content();
    expect(content).toContain('STORE_A_DRAFT_MARKER');
  });

  test('Store A preview token used against Store B MUST NOT expose Store A draft theme', async ({ page }) => {
    await page.goto(`${STORE_B_BASE_URL}/ar?theme_preview=valid-preview-token-store-a`);
    const content = await page.content();
    expect(content).not.toContain('STORE_A_DRAFT_MARKER');
    expect(content).not.toContain('STORE_A_THEME_MARKER');
  });

  test('Invalid preview token falls back safely to safe public/error behavior', async ({ page }) => {
    await page.goto(`${STORE_A_BASE_URL}/en?theme_preview=invalid-preview-token`);
    const content = await page.content();
    expect(content).not.toContain('STORE_A_DRAFT_MARKER');
  });

  test('Preview requests carry Cache-Control: private, no-store and never poison public Redis cache', async ({ request, page }) => {
    // 1. Fetch public Store A -> Published
    await page.goto(`${STORE_A_BASE_URL}/en`);
    const public1 = await page.content();
    expect(public1).toContain('STORE_A_THEME_MARKER');

    // 2. Fetch valid Store A preview via API/page -> Draft, check no-store header
    const previewRes = await request.get(`${STORE_A_BASE_URL}/en?theme_preview=valid-preview-token-store-a`);
    const previewCc = previewRes.headers()['cache-control'] || '';
    // Preview response must not be cached by proxy or browser cache
    expect(previewCc).toMatch(/private|no-store|no-cache/);

    // 3. Fetch public Store A again -> Published (not poisoned by draft)
    await page.goto(`${STORE_A_BASE_URL}/en`);
    const public2 = await page.content();
    expect(public2).toContain('STORE_A_THEME_MARKER');
    expect(public2).not.toContain('STORE_A_DRAFT_MARKER');
  });
});
