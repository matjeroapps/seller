import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';

const SELLER_API_BASE_URL =
  process.env.SELLER_API_BASE_URL || process.env.NEXT_PUBLIC_SELLER_API_BASE_URL || 'http://127.0.0.1:18081';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxySellerRequest(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const upstreamUrl = new URL(`/${path.map(encodeURIComponent).join('/')}`, SELLER_API_BASE_URL);
  request.nextUrl.searchParams.forEach((value, key) => upstreamUrl.searchParams.append(key, value));

  const session = await getCurrentSession();
  const bearerToken = session.accessToken || (request.headers.get('authorization')?.startsWith('Bearer ')
    ? request.headers.get('authorization')?.slice(7)
    : null);

  if (!session.isAuthenticated || !bearerToken) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Actor authentication required' },
      { status: 401 }
    );
  }

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  const accept = request.headers.get('accept');

  if (contentType) headers.set('content-type', contentType);
  if (accept) headers.set('accept', accept);
  headers.set('authorization', `Bearer ${bearerToken}`);

  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();
  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body,
    cache: 'no-store',
  });

  const responseHeaders = new Headers();
  const upstreamContentType = upstreamResponse.headers.get('content-type');
  if (upstreamContentType) responseHeaders.set('content-type', upstreamContentType);

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxySellerRequest;
export const POST = proxySellerRequest;
export const PUT = proxySellerRequest;
export const PATCH = proxySellerRequest;
export const DELETE = proxySellerRequest;
