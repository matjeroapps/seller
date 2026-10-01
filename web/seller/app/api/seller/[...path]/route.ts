import { NextRequest, NextResponse } from 'next/server';

const SELLER_API_BASE_URL =
  process.env.SELLER_API_BASE_URL || process.env.NEXT_PUBLIC_SELLER_API_BASE_URL || 'http://127.0.0.1:18081';
const SELLER_API_BEARER_TOKEN = process.env.SELLER_API_BEARER_TOKEN;

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxySellerRequest(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const upstreamUrl = new URL(`/${path.map(encodeURIComponent).join('/')}`, SELLER_API_BASE_URL);
  request.nextUrl.searchParams.forEach((value, key) => upstreamUrl.searchParams.append(key, value));

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  const accept = request.headers.get('accept');
  const cookie = request.headers.get('cookie');

  if (contentType) headers.set('content-type', contentType);
  if (accept) headers.set('accept', accept);
  if (cookie) headers.set('cookie', cookie);
  if (SELLER_API_BEARER_TOKEN) headers.set('authorization', `Bearer ${SELLER_API_BEARER_TOKEN}`);
  else if (request.headers.get('authorization')) headers.set('authorization', request.headers.get('authorization') || '');

  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();
  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body,
    cache: 'no-store'
  });

  const responseHeaders = new Headers();
  const upstreamContentType = upstreamResponse.headers.get('content-type');
  if (upstreamContentType) responseHeaders.set('content-type', upstreamContentType);

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders
  });
}

export const GET = proxySellerRequest;
export const POST = proxySellerRequest;
export const PUT = proxySellerRequest;
export const PATCH = proxySellerRequest;
export const DELETE = proxySellerRequest;
