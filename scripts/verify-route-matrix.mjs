#!/usr/bin/env node

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

import crypto from 'node:crypto';

const BASE_URL = process.env.SELLER_BASE_URL || 'http://127.0.0.1:3000';
const STORE_ID = process.env.SELLER_STORE_ID || 'store_default';
const PRODUCT_ID = process.env.SELLER_PRODUCT_ID || 'prod_default';
const LISTING_ID = process.env.SELLER_LISTING_ID || 'list_default';
const ORDER_ID = process.env.SELLER_ORDER_ID || 'order_default';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-seller-session-secret-32-bytes-long';

function generateSellerSessionCookie() {
  const payload = {
    isAuthenticated: true,
    user: {
      id: 'usr_test_seller',
      email: 'seller@matjer.local',
      name: 'Verified Seller',
      roles: ['seller'],
    },
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

const signedSessionCookie = generateSellerSessionCookie();

const contractPath = path.resolve(
  process.cwd(),
  '../specs/028-seller-portal-gap-closure/contracts/route-matrix.json'
);

let routeDefs = [];
if (fs.existsSync(contractPath)) {
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  routeDefs = contract.routes || [];
} else {
  routeDefs = [
    { id: 'root-dashboard', path: '/dashboard' },
    { id: 'onboarding', path: '/dashboard/onboarding' },
    { id: 'store-overview', path: `/dashboard/stores/${STORE_ID}` },
    { id: 'product-list', path: `/dashboard/stores/${STORE_ID}/catalog/products` },
    { id: 'product-new', path: `/dashboard/stores/${STORE_ID}/catalog/products/new` },
    { id: 'product-detail', path: `/dashboard/stores/${STORE_ID}/catalog/products/${PRODUCT_ID}` },
    { id: 'supplier-offers', path: `/dashboard/stores/${STORE_ID}/catalog/supplier-offers` },
    { id: 'listings-list', path: `/dashboard/stores/${STORE_ID}/catalog/listings` },
    { id: 'listing-detail', path: `/dashboard/stores/${STORE_ID}/catalog/listings/${LISTING_ID}` },
    { id: 'inventory', path: `/dashboard/stores/${STORE_ID}/inventory` },
    { id: 'media-library', path: `/dashboard/stores/${STORE_ID}/media` },
    { id: 'orders-list', path: `/dashboard/stores/${STORE_ID}/orders` },
    { id: 'order-detail', path: `/dashboard/stores/${STORE_ID}/orders/${ORDER_ID}` },
    { id: 'order-documents', path: `/dashboard/stores/${STORE_ID}/orders/${ORDER_ID}/documents` },
    { id: 'shipments-queue', path: `/dashboard/stores/${STORE_ID}/shipments` },
    { id: 'finance', path: `/dashboard/stores/${STORE_ID}/finance` },
    { id: 'storefront', path: `/dashboard/stores/${STORE_ID}/storefront` },
    { id: 'integrations', path: `/dashboard/stores/${STORE_ID}/integrations` },
    { id: 'settings', path: `/dashboard/stores/${STORE_ID}/settings` },
    { id: 'account', path: `/dashboard/stores/${STORE_ID}/account` },
    { id: 'deferred-customers', path: `/dashboard/stores/${STORE_ID}/customers` },
    { id: 'deferred-carts', path: `/dashboard/stores/${STORE_ID}/carts` },
    { id: 'deferred-billing', path: `/dashboard/stores/${STORE_ID}/billing` },
    { id: 'deferred-notifications', path: `/dashboard/stores/${STORE_ID}/notifications` },
    { id: 'deferred-analytics', path: `/dashboard/stores/${STORE_ID}/analytics` },
  ];
}

function resolvePath(pattern) {
  return pattern
    .replace(':store_id', STORE_ID)
    .replace(':product_id', PRODUCT_ID)
    .replace(':listing_id', LISTING_ID)
    .replace(':order_id', ORDER_ID);
}

function fetchRoute(urlPath) {
  return new Promise((resolve) => {
    const fullUrl = new URL(urlPath, BASE_URL);
    const client = fullUrl.protocol === 'https:' ? https : http;

    const req = client.get(
      fullUrl,
      {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml',
          'User-Agent': 'MatjerHubRouteMatrixCrawler/1.0',
          Cookie: `mh_seller_session=${signedSessionCookie}; mh_active_store=${STORE_ID}`,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          const isRedirect = [301, 302, 307, 308].includes(res.statusCode);
          const redirectLocation = res.headers.location || null;
          const isAuthRedirect = isRedirect && redirectLocation?.includes('/login');
          const hasError =
            res.statusCode === 500 ||
            isAuthRedirect ||
            body.includes('Application error: a client-side exception has occurred') ||
            body.includes('Unhandled Runtime Error');

          resolve({
            url: urlPath,
            statusCode: res.statusCode,
            headers: res.headers,
            bodySnippet: body.slice(0, 500),
            hasError,
            is404: res.statusCode === 404,
            isRedirect,
            redirectLocation,
          });
        });
      }
    );

    req.on('error', (err) => {
      resolve({
        url: urlPath,
        statusCode: 0,
        headers: {},
        bodySnippet: err.message,
        hasError: true,
        is404: false,
        isRedirect: false,
        redirectLocation: null,
      });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        url: urlPath,
        statusCode: 408,
        headers: {},
        bodySnippet: 'Request Timeout after 5s',
        hasError: true,
        is404: false,
        isRedirect: false,
        redirectLocation: null,
      });
    });
  });
}

export async function runRouteMatrix() {
  console.log(`Starting Seller Dashboard Route Matrix against ${BASE_URL}...\n`);
  const results = [];

  for (const def of routeDefs) {
    if (def.path.includes('(customers|carts|billing|notifications|analytics)')) {
      const subRoutes = ['customers', 'carts', 'billing', 'notifications', 'analytics'];
      for (const sub of subRoutes) {
        const p = `/dashboard/stores/${STORE_ID}/${sub}`;
        const res = await fetchRoute(p);
        results.push({ ...res, id: `deferred-${sub}`, expected: def.expected_behavior });
      }
      continue;
    }

    const p = resolvePath(def.path);
    const res = await fetchRoute(p);
    results.push({ ...res, id: def.id, expected: def.expected_behavior });
  }

  console.log('Route Matrix Results:');
  console.log('------------------------------------------------------------');
  let failures = 0;
  for (const r of results) {
    const statusMark = r.statusCode === 200 ? 'PASS' : r.isRedirect ? 'REDIR' : 'FAIL';
    if (r.hasError || r.is404) failures++;
    console.log(`[${statusMark}] ${r.statusCode} ${r.url} (ID: ${r.id})`);
    if (r.isRedirect) console.log(`       -> Redirects to: ${r.redirectLocation}`);
  }
  console.log('------------------------------------------------------------');
  console.log(`Total Routes Checked: ${results.length} | Failures: ${failures}\n`);

  return { total: results.length, failures, results };
}

if (process.argv[1] && process.argv[1].endsWith('verify-route-matrix.mjs')) {
  runRouteMatrix()
    .then((out) => {
      if (out.failures > 0) {
        process.exitCode = 1;
      }
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
