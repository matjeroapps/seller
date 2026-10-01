import { NextResponse, type NextRequest } from 'next/server';

import { clearAuthTransaction, exchangeCodeForTokens, fetchUserInfo, getAuthTransaction, getZitadelConfig, getZitadelServerEndpoints, setCurrentSession, verifySellerApiAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function redirectTo(request: NextRequest, path: string) {
  const publicBaseUrl = process.env.NEXT_PUBLIC_SELLER_APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  return NextResponse.redirect(new URL(path, publicBaseUrl || request.url));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const error = request.nextUrl.searchParams.get('error');

  if (error) {
    return redirectTo(request, '/login?error=provider');
  }

  if (!code || !state) {
    return redirectTo(request, '/login?error=missing_code');
  }

  const transaction = await getAuthTransaction();
  if (!transaction || transaction.state !== state) {
    return redirectTo(request, '/login?error=state');
  }

  try {
    const config = getZitadelConfig();
    const endpoints = getZitadelServerEndpoints(config);
    const tokens = await exchangeCodeForTokens(config, endpoints, code, transaction.codeVerifier);
    const user = await fetchUserInfo(endpoints, tokens.access_token);

    await verifySellerApiAccess(tokens.access_token, user.id);

    await setCurrentSession({
      isAuthenticated: true,
      user,
      expiresAt: Date.now() + (tokens.expires_in || 12 * 60 * 60) * 1000
    });
    await clearAuthTransaction();
  } catch {
    await clearAuthTransaction();
    return redirectTo(request, '/login?error=session');
  }

  return redirectTo(request, transaction.redirectTo);
}
