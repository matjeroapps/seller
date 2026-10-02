import { test, expect } from '@playwright/test';
import { SELLER_ACTORS, STORE_FIXTURES } from './support/seller-actors';

test.describe('Seller Actor Session Security & Proxy Forwarding (T010)', () => {
  test('prohibits unauthenticated access to seller proxy routes', async ({ request }) => {
    // Attempt proxy call with no session cookie or token
    const response = await request.get('/api/seller/v1/stores/str_a1_1001/dashboard');
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('unauthorized');
  });

  test('prohibits proxy fallback to SELLER_API_BEARER_TOKEN when no session cookie exists', async ({ request }) => {
    // Ensure proxy does not accept unauthenticated calls even if SELLER_API_BEARER_TOKEN environment variable is set
    const response = await request.get('/api/seller/v1/stores/str_a1_1001/catalog/products');
    expect(response.status()).toBe(401);
  });
});
