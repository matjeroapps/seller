import 'server-only';

import { runtimeConfig, type StorefrontRuntimeConfig } from './config';

/**
 * Tenant resolution.
 *
 * The customer host is the only tenant authority in the storefront. It is read
 * from the incoming server request and forwarded to storefront-api, which applies
 * its own trusted-proxy policy and hands the host to Core's store resolver.
 *
 * Nothing a browser can set — a query parameter, a cookie, local storage, a store
 * or seller identifier — participates in this decision. `X-Forwarded-Host` is read
 * only when the deployment declares it sits behind a trusted proxy, exactly as
 * storefront-api does, so the frontend never establishes a weaker trust boundary
 * than the service behind it.
 */

/** Header names, lowercased because `next/headers` normalizes them. */
const HOST_HEADER = 'host';
const FORWARDED_HOST_HEADER = 'x-forwarded-host';

/**
 * normalizeHost lowercases a host and strips the port, whitespace and any IPv6
 * brackets. It mirrors the normalization storefront-api performs so both sides
 * agree on what a host is before one is sent.
 */
export function normalizeHost(raw: string): string {
  let host = raw.trim().toLowerCase();
  if (host.startsWith('[')) {
    const closing = host.indexOf(']');
    return closing > 0 ? host.slice(1, closing) : '';
  }
  const colon = host.indexOf(':');
  if (colon >= 0) {
    host = host.slice(0, colon);
  }
  // A host is used verbatim as an HTTP header value, so anything that is not a
  // plausible hostname is discarded rather than forwarded.
  return /^[a-z0-9.-]+$/.test(host) ? host : '';
}

/**
 * resolveTenantHost derives the authoritative customer host from request headers.
 *
 * When multiple forwarded hosts are present the first is taken, which is the
 * original client-facing host in the standard proxy convention.
 */
export function resolveTenantHost(
  headers: Headers,
  config: StorefrontRuntimeConfig = runtimeConfig()
): string {
  if (config.trustForwardedHost) {
    const forwarded = headers.get(FORWARDED_HOST_HEADER);
    if (forwarded) {
      const host = normalizeHost(forwarded.split(',')[0] ?? '');
      if (host) {
        return host;
      }
    }
  }

  const host = normalizeHost(headers.get(HOST_HEADER) ?? '');
  return host || normalizeHost(config.fallbackHost);
}
