'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';

import { merchantSupplyApi, type SupplyReviewCase } from '@/lib/api/merchant-console';
import { SupplyEmpty, SupplyError, SupplyLoading } from '@/components/supply/supply-state';

export default function SupplyReviewCaseDetailPage({
  params
}: {
  params: Promise<{ merchant_id: string; case_id: string }>;
}) {
  const { merchant_id, case_id } = use(params);
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'denied' } | { status: 'error' } | { status: 'ready'; data: SupplyReviewCase }
  >({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    merchantSupplyApi
      .getReviewCase(merchant_id, case_id, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: 'ready', data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [merchant_id, case_id]);

  return (
    <div className="space-y-6" data-testid="supply-review-case-detail">
      <Link
        href={`/dashboard/merchants/${merchant_id}/supply/review-cases`}
        className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        ← Review cases
      </Link>

      {state.status === 'loading' && <SupplyLoading />}
      {state.status === 'error' && <SupplyError />}
      {state.status === 'ready' && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{state.data.case_type}</h1>
          <p className="text-xs text-slate-500 mt-1">
            Status <span className="font-semibold">{state.data.status}</span> · reason {state.data.reason_code}
          </p>
          {state.data.status !== 'OPEN' && (
            <p className="text-xs text-slate-500 mt-2">
              Resolution: {state.data.resolution || '—'} {state.data.resolved_by ? `by ${state.data.resolved_by}` : ''}
            </p>
          )}
          <pre className="mt-4 overflow-x-auto rounded bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-300">
            {JSON.stringify(state.data.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
