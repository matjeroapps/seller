import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { LOCALE_HEADER, PATH_HEADER } from '../src/lib/headers';
import { config, proxy } from '../src/proxy';

/**
 * Proxy tests.
 *
 * The proxy is the only place internal request headers are set, and the only place inbound
 * copies of them are removed. Both halves matter: without the removal a client could
 * declare its own locale and path and change what the document renders.
 */

function request(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(`https://store-a.example${path}`), { headers: new Headers(headers) });
}

function forwarded(response: Response): Headers {
  // NextResponse.next({ request }) records the rewritten request headers on the response.
  const overrides = response.headers.get('x-middleware-override-headers') ?? '';
  const result = new Headers();
  for (const name of overrides.split(',').map((value) => value.trim()).filter(Boolean)) {
    const value = response.headers.get(`x-middleware-request-${name}`);
    if (value !== null) {
      result.set(name, value);
    }
  }
  return result;
}

describe('proxy', () => {
  it('publishes the locale and the path within it', () => {
    const headers = forwarded(proxy(request('/ar/products/aurora-desk-lamp')));

    expect(headers.get(LOCALE_HEADER)).toBe('ar');
    expect(headers.get(PATH_HEADER)).toBe('/products/aurora-desk-lamp');
  });

  it('publishes an empty path for a locale home page', () => {
    const headers = forwarded(proxy(request('/en')));

    expect(headers.get(LOCALE_HEADER)).toBe('en');
    expect(headers.get(PATH_HEADER)).toBe('');
  });

  it('publishes no locale for an unsupported segment', () => {
    for (const path of ['/', '/fr/products', '/products', '/EN']) {
      const headers = forwarded(proxy(request(path)));
      expect(headers.get(LOCALE_HEADER)).toBeNull();
      expect(headers.get(PATH_HEADER)).toBeNull();
    }
  });

  it('discards an inbound locale header a client tried to supply', () => {
    const headers = forwarded(
      proxy(request('/en/products', { [LOCALE_HEADER]: 'ar', [PATH_HEADER]: '/somewhere-else' }))
    );

    expect(headers.get(LOCALE_HEADER)).toBe('en');
    expect(headers.get(PATH_HEADER)).toBe('/products');
  });

  it('discards an inbound internal header even when no locale replaces it', () => {
    const headers = forwarded(
      proxy(request('/', { [LOCALE_HEADER]: 'ar', 'x-matjero-anything': 'injected' }))
    );

    expect(headers.get(LOCALE_HEADER)).toBeNull();
    expect(headers.get('x-matjero-anything')).toBeNull();
  });

  it('leaves the host header alone', () => {
    const headers = forwarded(proxy(request('/en', { host: 'store-a.example' })));

    expect(headers.get('host')).toBe('store-a.example');
  });

  it('skips framework assets', () => {
    const matcher = config.matcher[0];
    const pattern = new RegExp(`^${matcher}$`);

    expect(pattern.test('/en/products')).toBe(true);
    expect(pattern.test('/')).toBe(true);
    expect(pattern.test('/_next/static/chunk.js')).toBe(false);
    expect(pattern.test('/favicon.ico')).toBe(false);
  });

  it('extracts theme_preview parameter into internal token header and sets response headers', () => {
    const res = proxy(request('/en?theme_preview=valid-token-abc'));
    const headers = forwarded(res);

    expect(headers.get('x-matjero-preview-token')).toBe('valid-token-abc');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(res.headers.get('Pragma')).toBe('no-cache');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
  });

  it('rejects duplicate theme_preview parameters', () => {
    const res = proxy(request('/en?theme_preview=token1&theme_preview=token2'));
    const headers = forwarded(res);

    expect(headers.get('x-matjero-preview-invalid')).toBe('duplicate_token_param');
    expect(headers.get('x-matjero-preview-token')).toBeNull();
  });

  it('rejects oversized theme_preview parameter', () => {
    const oversized = 'A'.repeat(4097);
    const res = proxy(request(`/en?theme_preview=${oversized}`));
    const headers = forwarded(res);

    expect(headers.get('x-matjero-preview-invalid')).toBe('invalid_token_size');
    expect(headers.get('x-matjero-preview-token')).toBeNull();
  });
});
