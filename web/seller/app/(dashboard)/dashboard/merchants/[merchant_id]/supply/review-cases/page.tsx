'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';

import { merchantSupplyApi, type SupplyReviewCase } from '@/lib/api/merchant-console';
import { SupplyEmpty, SupplyError, SupplyLoading } from '@/components/supply/supply-state';

export default function SupplyReviewCasesPage({ params }: { params: Promise<{ merchant_id: string }> }) {
  const { merchant_id } = use(params);
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'denied' } | { status: 'error' } | { status: 'empty' } | { status: 'ready'; data: SupplyReviewCase[] }
  >({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    merchantSupplyApi
      .listReviewCases(merchant_id, { status: 'OPEN' }, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setState(data.length === 0 ? { status: 'empty' } : { status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState(error instanceof Error && error.name === 'AbortError' ? { status: 'loading' } : { status: 'error' });
      });
    return () => controller.abort();
  }, [merchant_id]);

  return (
    <div className="space-y-6" data-testid="supply-review-cases">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Review cases</h1>
        <p className="text-xs text-slate-500 mt-0.5">Open cases awaiting a merchant decision. Decisions map to the merged merchant decision endpoints.</p>
      </div>

      {state.status === 'loading' && <SupplyLoading />}
      {state.status === 'error' && <SupplyError />}
      {state.status === 'empty' && <SupplyEmpty title="No open review cases" message="Cases that need your decision will appear here." />}
      {state.status === 'ready' && (
        <ul className="space-y-3">
          {state.data.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard/merchants/${merchant_id}/supply/review-cases/${c.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{c.case_type}</span>
                  <span className="text-xs font-semibold uppercase rounded px-1.5 py-0.5 bg-amber-100 text-amber-800">{c.status}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">Reason: {c.reason_code}</div>
                <div className="text-xs text-slate-400 mt-1">{new Date(c.created_at).toLocaleString()}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
