import { LoginPanel } from '@/components/auth/LoginPanel';

export const metadata = {
  title: 'Sign In'
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ redirect?: string; error?: string }> }) {
  const params = await searchParams;

  return (
    <LoginPanel error={params.error} redirectTo={params.redirect || '/dashboard'} />
  );
}
