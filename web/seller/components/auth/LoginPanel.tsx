'use client';

import { Button, Card } from '@matjerhub/ui-sdk';
import { ShieldCheck } from 'lucide-react';

import { startLogin } from '@/app/(auth)/login/actions';

function getErrorMessage(error?: string): string | undefined {
  switch (error) {
    case 'unauthorized':
      return 'Your account is signed in, but it does not have Seller Portal access yet. Start registration from the Merchant portal or contact an administrator.';
    case 'provider':
      return 'MatjerHub SSO could not complete the authentication request. Please try again.';
    case 'missing_code':
    case 'state':
      return 'The authentication link expired or was invalid. Please start again.';
    case 'session':
      return 'We could not verify your MatjerHub SSO session. Please try again.';
    default:
      return error ? 'Authentication could not be completed. Please try again.' : undefined;
  }
}

export function LoginPanel({ error, redirectTo }: { error?: string; redirectTo: string }) {
  const errorMessage = getErrorMessage(error);
  const isUnauthorized = error === 'unauthorized';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-[420px]" padding="lg">
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white">
            <ShieldCheck aria-hidden="true" className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-600">MatjerHub Seller Portal</p>
            <h1 className="text-2xl font-bold text-slate-950">Sign in to manage your commerce workspace</h1>
            <p className="text-sm text-slate-600">Use MatjerHub SSO to continue to the seller application shell.</p>
          </div>
          {errorMessage ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <form action={startLogin} className="space-y-4">
            <input type="hidden" name="redirect" value={redirectTo} />
            {isUnauthorized ? <input type="hidden" name="prompt" value="login" /> : null}
            <Button type="submit" size="lg" className="w-full">
              {isUnauthorized ? 'Sign in with a different account' : 'Continue with MatjerHub SSO'}
            </Button>
          </form>
          {isUnauthorized ? (
            <div className="space-y-2 text-sm text-slate-600">
              <p>Need a Seller Portal account?</p>
              <form action={startLogin}>
                <input type="hidden" name="redirect" value={redirectTo} />
                <input type="hidden" name="prompt" value="create" />
                <button
                  type="submit"
                  className="font-semibold text-[var(--color-primary)] underline underline-offset-4 hover:opacity-80"
                >
                  Create a merchant account
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
