import 'server-only';

import { Agent as HttpAgent, request as httpRequest, type IncomingMessage } from 'node:http';
import { Agent as HttpsAgent, request as httpsRequest } from 'node:https';

import type { Locale } from '../i18n/locales';
import { runtimeConfig, type StorefrontRuntimeConfig } from '../server/config';
import type {
  CatalogQuery,
  CategoryNode,
  ProductDetail,
  ProductPage,
  StoreBootstrap
} from './contracts';
import { MAX_PAGE_SIZE } from './contracts';

/**
 * Server-side client for the Seller storefront API.
 *
 * The storefront frontend never calls Core. It calls this repository's own public
 * service, which owns tenant resolution, the catalog contract and the payload
 * cache; Core stays behind that boundary (ADR-017).
 *
 * Two properties shape the implementation:
 *
 *  1. Tenant identity travels in the HTTP `Host` header. storefront-api treats the
 *     request Host as authoritative and only prefers `X-Forwarded-Host` when it is
 *     explicitly configured to trust a proxy, so setting `Host` is the one signal
 *     that works under both policies. WHATWG `fetch` forbids overriding `Host`, so
 *     the request is issued through `node:http`/`node:https`, where it can be set.
 *
 *  2. Responses are read defensively. A body is size-bounded, parsed inside a
 *     try/catch and never trusted to be the declared shape without a check, so a
 *     malformed upstream response surfaces as a typed error instead of a render
 *     crash that leaks a stack trace to a customer.
 */

export type StorefrontErrorKind =
  /** The store, or the requested resource within it, is not publicly available. */
  | 'not_found'
  /** The request itself was rejected: an unusable filter, sort or page. */
  | 'invalid_request'
  /** The service could not answer: unreachable, timed out, or degraded. */
  | 'unavailable'
  /** The service answered with something this client cannot use. */
  | 'unexpected';

export class StorefrontApiError extends Error {
  readonly kind: StorefrontErrorKind;
  readonly status: number;

  constructor(kind: StorefrontErrorKind, status: number, message: string) {
    // The message is for server logs only. No page renders it, because it can
    // name the internal service address or carry transport detail.
    super(message);
    this.name = 'StorefrontApiError';
    this.kind = kind;
    this.status = status;
  }
}

export function isStorefrontApiError(error: unknown): error is StorefrontApiError {
  return error instanceof StorefrontApiError;
}

/** 1 MiB. Larger than any legitimate catalog page, small enough to bound memory. */
const MAX_RESPONSE_BYTES = 1_048_576;

const httpAgent = new HttpAgent({ keepAlive: true, maxSockets: 64 });
const httpsAgent = new HttpsAgent({ keepAlive: true, maxSockets: 64 });

type RawResponse = {
  status: number;
  body: string;
};

/**
 * send performs one request against the storefront API.
 *
 * `host` becomes the outgoing `Host` header and is therefore the tenant authority
 * for this call. It is always a value the server derived from the incoming request,
 * never anything a browser supplied.
 */
async function send(
  url: URL,
  host: string,
  locale: Locale,
  config: StorefrontRuntimeConfig,
  previewToken?: string
): Promise<RawResponse> {
  const secure = url.protocol === 'https:';
  const perform = secure ? httpsRequest : httpRequest;
  const requestHeaders: Record<string, string> = {
    // The tenant. storefront-api normalizes it again on arrival.
    Host: host,
    Accept: 'application/json',
    'Accept-Language': locale
  };
  if (previewToken) {
    requestHeaders['X-Matjero-Storefront-Preview'] = previewToken;
  }

  return new Promise<RawResponse>((resolve, reject) => {
    const request = perform(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (secure ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        agent: secure ? httpsAgent : httpAgent,
        headers: requestHeaders
      },
      (response: IncomingMessage) => {
        const chunks: Buffer[] = [];
        let size = 0;

        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_RESPONSE_BYTES) {
            response.destroy();
            reject(
              new StorefrontApiError('unexpected', 0, 'storefront response exceeded size limit')
            );
            return;
          }
          chunks.push(chunk);
        });

        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8')
          });
        });

        response.on('error', (error: Error) => {
          reject(new StorefrontApiError('unavailable', 0, `storefront read failed: ${error.message}`));
        });
      }
    );

    request.setTimeout(config.requestTimeoutMs, () => {
      request.destroy();
      reject(new StorefrontApiError('unavailable', 0, 'storefront request timed out'));
    });

    request.on('error', (error: Error) => {
      reject(new StorefrontApiError('unavailable', 0, `storefront request failed: ${error.message}`));
    });

    request.end();
  });
}

function errorForStatus(status: number): StorefrontErrorKind {
  if (status === 404) {
    return 'not_found';
  }
  if (status === 400) {
    return 'invalid_request';
  }
  if (status === 503 || status >= 500) {
    return 'unavailable';
  }
  return 'unexpected';
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    throw new StorefrontApiError('unexpected', 0, 'storefront returned unparseable JSON');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * buildUrl assembles a request URL from the configured base and a route.
 *
 * Path segments are percent-encoded and query values go through URLSearchParams,
 * so a slug or a search keyword can never inject a path segment or a parameter.
 */
function buildUrl(baseUrl: string, segments: string[], query: URLSearchParams): URL {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const url = new URL(`v1/storefront/${segments.map(encodeURIComponent).join('/')}`, base);
  url.search = query.toString();
  return url;
}

function queryFor(locale: Locale, catalog?: CatalogQuery): URLSearchParams {
  const params = new URLSearchParams();
  // The API's documented locale contract: an explicit override wins over
  // Accept-Language, which makes each render deterministic.
  params.set('locale', locale);

  if (!catalog) {
    return params;
  }
  if (catalog.category) {
    params.set('category', catalog.category);
  }
  if (catalog.keyword) {
    params.set('q', catalog.keyword);
  }
  if (catalog.availability) {
    params.set('availability', catalog.availability);
  }
  if (catalog.sort) {
    params.set('sort', catalog.sort);
  }
  if (typeof catalog.minPriceMinor === 'number') {
    params.set('min_price', String(catalog.minPriceMinor));
  }
  if (typeof catalog.maxPriceMinor === 'number') {
    params.set('max_price', String(catalog.maxPriceMinor));
  }
  if (typeof catalog.limit === 'number') {
    params.set('limit', String(Math.min(catalog.limit, MAX_PAGE_SIZE)));
  }
  if (typeof catalog.offset === 'number') {
    params.set('offset', String(catalog.offset));
  }
  return params;
}

export type StorefrontClient = {
  store(host: string, locale: Locale, previewToken?: string): Promise<StoreBootstrap>;
  categories(host: string, locale: Locale): Promise<CategoryNode[]>;
  category(host: string, locale: Locale, slug: string): Promise<CategoryNode>;
  products(host: string, locale: Locale, query?: CatalogQuery): Promise<ProductPage>;
  product(host: string, locale: Locale, slug: string): Promise<ProductDetail>;
  search(host: string, locale: Locale, query?: CatalogQuery): Promise<ProductPage>;
};

export function createStorefrontClient(
  config: StorefrontRuntimeConfig = runtimeConfig()
): StorefrontClient {
  async function read(
    host: string,
    locale: Locale,
    segments: string[],
    catalog?: CatalogQuery,
    previewToken?: string
  ): Promise<unknown> {
    if (!host) {
      // No trusted host means no tenant. Treated exactly as an unresolvable store
      // rather than defaulting to some other store's content.
      throw new StorefrontApiError('not_found', 404, 'no tenant host on request');
    }

    const url = buildUrl(config.apiBaseUrl, segments, queryFor(locale, catalog));
    const response = await send(url, host, locale, config, previewToken);

    if (response.status !== 200) {
      throw new StorefrontApiError(
        errorForStatus(response.status),
        response.status,
        `storefront api responded ${response.status}`
      );
    }
    return parseJson(response.body);
  }

  function requireRecord(payload: unknown, field: string): Record<string, unknown> {
    if (!isRecord(payload) || !isRecord(payload[field])) {
      throw new StorefrontApiError('unexpected', 0, `storefront response missing ${field}`);
    }
    return payload[field];
  }

  function requireArray(payload: unknown, field: string): unknown[] {
    if (!isRecord(payload) || !Array.isArray(payload[field])) {
      throw new StorefrontApiError('unexpected', 0, `storefront response missing ${field}`);
    }
    return payload[field];
  }

  function toProductPage(payload: unknown): ProductPage {
    const items = requireArray(payload, 'items') as ProductPage['items'];
    const pagination = isRecord(payload) && isRecord(payload.pagination) ? payload.pagination : {};
    return {
      items,
      pagination: {
        total: typeof pagination.total === 'number' ? pagination.total : items.length,
        limit: typeof pagination.limit === 'number' ? pagination.limit : items.length,
        offset: typeof pagination.offset === 'number' ? pagination.offset : 0
      }
    };
  }

  return {
    async store(host, locale, previewToken) {
      return requireRecord(await read(host, locale, ['store'], undefined, previewToken), 'store') as unknown as StoreBootstrap;
    },
    async categories(host, locale) {
      return requireArray(
        await read(host, locale, ['categories']),
        'items'
      ) as unknown as CategoryNode[];
    },
    async category(host, locale, slug) {
      return requireRecord(
        await read(host, locale, ['categories', slug]),
        'category'
      ) as unknown as CategoryNode;
    },
    async products(host, locale, query) {
      return toProductPage(await read(host, locale, ['products'], query));
    },
    async product(host, locale, slug) {
      return requireRecord(
        await read(host, locale, ['products', slug]),
        'product'
      ) as unknown as ProductDetail;
    },
    async search(host, locale, query) {
      return toProductPage(await read(host, locale, ['search'], query));
    }
  };
}
