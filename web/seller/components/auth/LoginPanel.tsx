'use client';

import { Button, Card } from '@matjerhub/ui-sdk';
import { ShieldCheck } from 'lucide-react';

import { startLogin } from '@/app/(auth)/login/actions';

export function LoginPanel({ error, redirectTo }: { error?: string; redirectTo: string }) {
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
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              Authentication could not be completed. Please try again.
            </p>
          ) : null}
          <form action={startLogin} className="space-y-4">
            <input type="hidden" name="redirect" value={redirectTo} />
            <Button type="submit" size="lg" className="w-full">
              Continue with MatjerHub SSO
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
