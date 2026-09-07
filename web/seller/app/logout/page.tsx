import { clearSession, getLogoutUrl, getZitadelConfig, getZitadelEndpoints } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function LogoutPage() {
  await clearSession();

  const config = getZitadelConfig();
  const endpoints = getZitadelEndpoints(config);
  redirect(getLogoutUrl(config, endpoints));
}
