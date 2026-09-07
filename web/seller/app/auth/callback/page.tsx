import { redirect } from 'next/navigation';

import { clearAuthTransaction, exchangeCodeForTokens, fetchUserInfo, getAuthTransaction, getZitadelConfig, getZitadelEndpoints, setCurrentSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AuthCallbackPage({
  searchParams
}: {
  searchParams: Promise<{ code?: string; state?: string; error?: string }>;
}) {
  const params = await searchParams;

  if (params.error) {
    redirect('/login?error=provider');
  }

  if (!params.code || !params.state) {
    redirect('/login?error=missing_code');
  }

  const transaction = await getAuthTransaction();
  if (!transaction || transaction.state !== params.state) {
    redirect('/login?error=state');
  }

  try {
    const config = getZitadelConfig();
    const endpoints = getZitadelEndpoints(config);
    const tokens = await exchangeCodeForTokens(config, endpoints, params.code, transaction.codeVerifier);
    const user = await fetchUserInfo(endpoints, tokens.access_token);

    await setCurrentSession({
      isAuthenticated: true,
      user,
      expiresAt: Date.now() + (tokens.expires_in || 12 * 60 * 60) * 1000
    });
    await clearAuthTransaction();
  } catch {
    await clearAuthTransaction();
    redirect('/login?error=session');
  }

  redirect(transaction.redirectTo);
}
