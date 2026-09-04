export const STORE_A_HOST = 'store-a.localhost:3000';
export const STORE_B_HOST = 'store-b.localhost:3000';
export const STORE_A_BASE_URL = 'http://store-a.localhost:3000';
export const STORE_B_BASE_URL = 'http://store-b.localhost:3000';

export const STORE_A_MARKER = 'STORE_A_ONLY_MARKER';
export const STORE_B_MARKER = 'STORE_B_ONLY_MARKER';

export const FAKE_CORE_CONTROL_URL = process.env.FAKE_CORE_CONTROL_URL || 'http://127.0.0.1:18080';
export const STOREFRONT_API_URL = process.env.STOREFRONT_API_BASE_URL || 'http://127.0.0.1:8080';

export const PRIVACY_EXTRA_FIELDS_REVISION = 91001;
export const PERF_REVISION_HOME = 92001;
export const PERF_REVISION_CATALOG = 92002;
export const PERF_REVISION_PRODUCT = 92003;
export const PERF_REVISION_SEARCH = 92004;
export const PERF_REVISION_SITEMAP = 92005;

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

import http from 'node:http';

export function httpGetStorefrontApi(path: string, host: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `http://127.0.0.1:8080${path}`,
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
