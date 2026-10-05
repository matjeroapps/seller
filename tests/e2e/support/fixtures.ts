import type { APIRequestContext } from '@playwright/test';

export const STORE_A_HOST = process.env.STORE_A_HOST || 'store-a.localhost:3000';
export const STORE_B_HOST = process.env.STORE_B_HOST || 'store-b.localhost:3000';
export const STORE_A_BASE_URL = process.env.STORE_A_BASE_URL || `http://${STORE_A_HOST}`;
export const STORE_B_BASE_URL = process.env.STORE_B_BASE_URL || `http://${STORE_B_HOST}`;

export const STORE_A_MARKER = 'STORE_A_ONLY_MARKER';
export const STORE_B_MARKER = 'STORE_B_ONLY_MARKER';

export const FAKE_CORE_CONTROL_URL = process.env.FAKE_CORE_CONTROL_URL || 'http://127.0.0.1:18080';
export const STOREFRONT_API_URL = process.env.STOREFRONT_API_BASE_URL || 'http://127.0.0.1:8080';

export function getUniqueTestRevision(): number {
  return Date.now() + Math.floor(Math.random() * 10000);
}

export async function getCallCounts(): Promise<Record<string, number>> {
  const res = await fetch(`${FAKE_CORE_CONTROL_URL}/test-control/calls`);
  const data = await res.json();
  return data.calls || {};
}

export async function resetCallCounts(): Promise<void> {
  await fetch(`${FAKE_CORE_CONTROL_URL}/test-control/calls/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function getExtraFieldEmissions(): Promise<number> {
  const res = await fetch(`${FAKE_CORE_CONTROL_URL}/test-control/extra-field-emissions`);
  const data = await res.json();
  return data.emissions || 0;
}

export async function bumpRevision(host: string): Promise<number> {
  const res = await fetch(`${FAKE_CORE_CONTROL_URL}/test-control/revision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, bump: true }),
  });
  const data = await res.json();
  return data.revision;
}

export async function setRevision(host: string, revision: number): Promise<number> {
  const res = await fetch(`${FAKE_CORE_CONTROL_URL}/test-control/revision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, revision }),
  });
  const data = await res.json();
  return data.revision;
}

export async function updateProductField(host: string, slug: string, field: string, value: any): Promise<void> {
  await fetch(`${FAKE_CORE_CONTROL_URL}/test-control/product`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, slug, field, value }),
  });
}

export async function setCoreUnavailable(unavailable: boolean): Promise<void> {
  await fetch(`${FAKE_CORE_CONTROL_URL}/test-control/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ unavailable }),
  });
}

export async function setExtraFieldsMode(enabled: boolean): Promise<void> {
  await fetch(`${FAKE_CORE_CONTROL_URL}/test-control/extra-fields`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
}

/**
 * Creates a real order through the storefront checkout contract so Seller
 * order-detail E2E tests never depend on removed frontend-only fixtures.
 */
export async function createTestOrder(request: APIRequestContext): Promise<{
  storeId: string;
  orderId: string;
}> {
  const cookieHeader = (setCookie: string | undefined): string => {
    if (!setCookie) return '';
    return setCookie
      .split('\n')
      .map((cookie) => cookie.split(';')[0])
      .filter(Boolean)
      .join('; ');
  };

  const cartResponse = await request.post(`${STOREFRONT_API_URL}/v1/storefront/carts`, {
    headers: { Host: STORE_A_HOST }
  });
  if (!cartResponse.ok()) {
    throw new Error(`Failed to create test cart: ${cartResponse.status()}`);
  }

  const cartCookie = cookieHeader(cartResponse.headers()['set-cookie']);
  if (!cartCookie) {
    throw new Error('Storefront cart did not return a session cookie');
  }

  const itemResponse = await request.post(`${STOREFRONT_API_URL}/v1/storefront/carts/items`, {
    headers: { Host: STORE_A_HOST, Cookie: cartCookie },
    data: { sku_id: 'sku-a-1', quantity: 1 }
  });
  if (!itemResponse.ok()) {
    throw new Error(`Failed to add test item to cart: ${itemResponse.status()}`);
  }

  const sessionResponse = await request.post(`${STOREFRONT_API_URL}/v1/storefront/checkout/sessions`, {
    headers: { Host: STORE_A_HOST, Cookie: cartCookie }
  });
  if (!sessionResponse.ok()) {
    throw new Error(`Failed to create test checkout session: ${sessionResponse.status()}`);
  }

  const session = (await sessionResponse.json()) as { id?: string };
  if (!session.id) {
    throw new Error('Storefront checkout session did not return an id');
  }

  const sessionCookie = cookieHeader(sessionResponse.headers()['set-cookie']);
  if (!sessionCookie) {
    throw new Error('Storefront checkout session did not return a session cookie');
  }

  const finalizeResponse = await request.post(
    `${STOREFRONT_API_URL}/v1/storefront/checkout/sessions/${session.id}/finalize`,
    {
      headers: { Host: STORE_A_HOST, Cookie: sessionCookie },
      data: {
        shipping_address: {
          recipient_name: 'Seller E2E Buyer',
          address_line_1: '1 Seller Test Street',
          city: 'Cairo',
          country_code: 'EG'
        },
        contact_email: 'seller-e2e@matjerhub.test'
      }
    }
  );
  if (!finalizeResponse.ok()) {
    throw new Error(`Failed to finalize test order: ${finalizeResponse.status()}`);
  }

  const order = (await finalizeResponse.json()) as { id?: string };
  if (!order.id) {
    throw new Error('Storefront checkout did not return an order id');
  }

  return { storeId: 'store-a', orderId: order.id };
}

export async function getTestAccessToken(request: APIRequestContext): Promise<string> {
  const coreControlUrl = process.env.FAKE_CORE_CONTROL_URL || 'http://127.0.0.1:18080';
  const response = await request.post(`${coreControlUrl}/test-control/token`, {
    data: { subject: process.env.FAKE_CORE_SELLER_SUBJECT || 'usr_seller_dev' }
  });
  if (!response.ok()) {
    throw new Error(`Failed to mint test access token: ${response.status()}`);
  }
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error('Fake Core did not return a test access token');
  }
  return payload.access_token;
}

export async function prepareOrderForShipment(
  request: APIRequestContext,
  storeId: string,
  orderId: string,
  accessToken: string
): Promise<void> {
  const sellerApiUrl =
    process.env.SELLER_API_BASE_URL || `http://127.0.0.1:${process.env.SELLER_API_PORT || '18081'}`;
  for (const targetStatus of ['confirmed', 'processing', 'ready_for_shipping']) {
    const response = await request.post(
      `${sellerApiUrl}/v1/seller/stores/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(orderId)}/transition`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: { target_status: targetStatus }
      }
    );
    if (!response.ok()) {
      throw new Error(`Failed to transition test order to ${targetStatus}: ${response.status()} ${await response.text()}`);
    }
  }
}

import http from 'node:http';

export function httpGetStorefrontApi(path: string, host: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `${STOREFRONT_API_URL}${path}`,
      {
        method: 'GET',
        headers: {
          Host: host,
          Accept: 'application/json',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode || 500, body }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

export async function resetFakeCore(): Promise<void> {
  await fetch(`${FAKE_CORE_CONTROL_URL}/test-control/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}
