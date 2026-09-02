import { describe, expect, it } from 'vitest';

import { normalizeHost, resolveTenantHost } from '../src/server/tenant';
import { runtimeConfig } from '../src/server/config';

const untrusted = { apiBaseUrl: 'http://api', trustForwardedHost: false, requestTimeoutMs: 1_000, fallbackHost: '' };
const trusted = { ...untrusted, trustForwardedHost: true };

function headers(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe('tenant resolution', () => {
  it('takes the request host as the tenant', () => {
    expect(resolveTenantHost(headers({ host: 'store-a.example' }), untrusted)).toBe('store-a.example');
  });

  it('normalizes case, whitespace and port', () => {
    expect(normalizeHost('  Store-A.Example:3000 ')).toBe('store-a.example');
    expect(normalizeHost('STORE-B.EXAMPLE')).toBe('store-b.example');
    expect(normalizeHost('[2001:db8::1]:8080')).toBe('2001:db8::1');
  });

  it('rejects a host that is not a plausible hostname', () => {
    for (const candidate of [
      'store a.example',
      'store-a.example/../internal',
      'store-a.example\r\nX-Injected: 1',
      'store-a.example?x=1',
      'store<script>.example',
      ''
    ]) {
      expect(normalizeHost(candidate)).toBe('');
    }
  });

  it('ignores X-Forwarded-Host unless the deployment trusts a proxy', () => {
    const requestHeaders = headers({ host: 'store-a.example', 'x-forwarded-host': 'store-b.example' });

    expect(resolveTenantHost(requestHeaders, untrusted)).toBe('store-a.example');
    expect(resolveTenantHost(requestHeaders, trusted)).toBe('store-b.example');
  });

  it('takes the original client host from a forwarded chain', () => {
    const requestHeaders = headers({
      host: 'internal-lb',
      'x-forwarded-host': 'store-a.example, edge-1.internal, edge-2.internal'
    });

    expect(resolveTenantHost(requestHeaders, trusted)).toBe('store-a.example');
  });

  it('falls back to the request host when a trusted forwarded value is unusable', () => {
    const requestHeaders = headers({ host: 'store-a.example', 'x-forwarded-host': ' , ' });

    expect(resolveTenantHost(requestHeaders, trusted)).toBe('store-a.example');
  });

  it('resolves no tenant when the request carries no usable host', () => {
    expect(resolveTenantHost(headers({}), untrusted)).toBe('');
    expect(resolveTenantHost(headers({ host: 'not a host' }), untrusted)).toBe('');
  });

  it('uses the configured development fallback only when nothing else resolves', () => {
    const withFallback = { ...untrusted, fallbackHost: 'Local-Store.Example:3000' };

    expect(resolveTenantHost(headers({}), withFallback)).toBe('local-store.example');
    expect(resolveTenantHost(headers({ host: 'store-a.example' }), withFallback)).toBe('store-a.example');
  });
});

describe('runtime config', () => {
  /** A minimal environment. `ProcessEnv` requires NODE_ENV, which is not read here. */
  function env(values: Record<string, string>): NodeJS.ProcessEnv {
    return { NODE_ENV: 'test', ...values } as NodeJS.ProcessEnv;
  }

  it('defaults to a private service address and no proxy trust', () => {
    const config = runtimeConfig(env({}));

    expect(config.apiBaseUrl).toBe('http://localhost:8080');
    expect(config.trustForwardedHost).toBe(false);
    expect(config.requestTimeoutMs).toBe(5_000);
    expect(config.fallbackHost).toBe('');
  });

  it('reads the storefront API address from the server environment', () => {
    const config = runtimeConfig(
      env({
        STOREFRONT_API_BASE_URL: ' http://storefront-api:8080 ',
        TRUSTED_FORWARDED_HOST: 'true',
        STOREFRONT_API_TIMEOUT_MS: '2500'
      })
    );

    expect(config.apiBaseUrl).toBe('http://storefront-api:8080');
    expect(config.trustForwardedHost).toBe(true);
    expect(config.requestTimeoutMs).toBe(2_500);
  });

  it('only trusts a forwarded host on an exact opt-in', () => {
    for (const value of ['false', 'TRUE', '1', 'yes', '']) {
      expect(runtimeConfig(env({ TRUSTED_FORWARDED_HOST: value })).trustForwardedHost).toBe(false);
    }
  });

  it('ignores an unusable timeout', () => {
    for (const value of ['0', '-1', 'soon', '']) {
      expect(runtimeConfig(env({ STOREFRONT_API_TIMEOUT_MS: value })).requestTimeoutMs).toBe(5_000);
    }
  });
});
