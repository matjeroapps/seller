import 'server-only';

/**
 * Server runtime configuration.
 *
 * Every value here is read from the process environment on the server only. None
 * of it is exposed through `NEXT_PUBLIC_*`, because the storefront API base URL is
 * a private service-network address that a browser must never learn or call: the
 * browser talks to this Next.js server, and this server talks to storefront-api.
 */

export type StorefrontRuntimeConfig = {
  /** Private base URL of the Seller storefront API, e.g. http://storefront-api:8080. */
  apiBaseUrl: string;
  /**
   * Whether the deployment sits behind a reverse proxy whose X-Forwarded-Host may
   * be trusted. It mirrors the storefront-api setting of the same name so both
   * sides of the boundary agree on which header carries the tenant.
   */
  trustForwardedHost: boolean;
  /** Per-request timeout for a single storefront API call, in milliseconds. */
  requestTimeoutMs: number;
  /**
   * Host used when the incoming request carries none. Only useful for local
   * development against a single seeded store; empty in production.
   */
  fallbackHost: string;
  /** Public protocol used when the request does not carry a trusted proxy value. */
  publicProtocol?: 'http' | 'https';
};

const DEFAULT_TIMEOUT_MS = 5_000;

function readTimeout(raw: string | undefined): number {
  if (!raw) {
    return DEFAULT_TIMEOUT_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

export function runtimeConfig(env: NodeJS.ProcessEnv = process.env): StorefrontRuntimeConfig {
  const publicProtocol = env.STOREFRONT_PUBLIC_PROTOCOL === 'http' ? 'http' : 'https';

  return {
    apiBaseUrl: (env.STOREFRONT_API_BASE_URL ?? 'http://localhost:8080').trim(),
    trustForwardedHost: env.TRUSTED_FORWARDED_HOST === 'true',
    requestTimeoutMs: readTimeout(env.STOREFRONT_API_TIMEOUT_MS),
    fallbackHost: (env.STOREFRONT_FALLBACK_HOST ?? '').trim(),
    publicProtocol
  };
}
