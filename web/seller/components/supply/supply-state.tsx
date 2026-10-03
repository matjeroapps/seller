'use client';

import { useEffect, useState } from 'react';

import { MerchantConsoleError } from '@/lib/api/merchant-console';

export type SupplyQueryState<T> =
  | { status: 'loading' }
  | { status: 'denied' }
  | { status: 'error' }
  | { status: 'empty' }
  | { status: 'ready'; data: T };

/**
 * Loads one supply read for the selected merchant workspace. Every request is
 * aborted when the workspace changes or the component unmounts, so stale
 * responses from a previous workspace are never applied (workspace-switch
 * isolation). A 403 from the server renders the access-denied state: server
 * authorization is authoritative, navigation is UX only.
 */
export function useSupplyQuery<T>(
  merchantId: string,
  fetcher: (signal: AbortSignal) => Promise<T>
): SupplyQueryState<T> {
  const [state, setState] = useState<SupplyQueryState<T>>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    fetcher(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        if (Array.isArray(data) && data.length === 0) {
          setState({ status: 'empty' });
          return;
        }
        setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof MerchantConsoleError && error.status === 403) {
          setState({ status: 'denied' });
          return;
        }
        setState({ status: 'error' });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId]);

  return state;
}

export function SupplyLoading() {
  return (
    <div className="space-y-3 animate-pulse" data-testid="supply-loading" role="status">
      <div className="h-6 w-48 bg-slate-200 rounded dark:bg-slate-800" />
      <div className="h-24 bg-slate-100 rounded dark:bg-slate-900" />
      <div className="h-24 bg-slate-100 rounded dark:bg-slate-900" />
    </div>
  );
}

export function SupplyError({ retryHint = true }: { retryHint?: boolean }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950" role="alert" data-testid="supply-error">
      <h2 className="text-base font-semibold text-red-900 dark:text-red-200">Something went wrong</h2>
      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
        {retryHint ? 'The data could not be loaded. Try again in a moment.' : 'The data could not be loaded.'}
      </p>
    </div>
  );
}

export function SupplyEmpty({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center dark:border-slate-700 dark:bg-slate-900" data-testid="supply-empty">
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">{message}</p>
    </div>
  );
}
