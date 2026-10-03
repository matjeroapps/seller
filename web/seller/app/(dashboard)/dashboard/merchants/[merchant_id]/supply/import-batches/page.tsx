'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';

import { merchantSupplyApi, type SupplyImportBatch } from '@/lib/api/merchant-console';
import { MerchantAccessDenied } from '@/components/shell/MerchantAccessDenied';
import { SupplyEmpty, SupplyError, SupplyLoading } from '@/components/supply/supply-state';

export default function SupplyImportBatchesPage({ params }: { params: Promise<{ merchant_id: string }> }) {
  const { merchant_id } = use(params);
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'denied' } | { status: 'error' } | { status: 'empty' } | { status: 'ready'; data: SupplyImportBatch[] }
  >({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    merchantSupplyApi
      .listImportBatches(merchant_id, {}, controller.signal)
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
    <div className="space-y-6" data-testid="supply-import-batches">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Import batches</h1>
        <p className="text-xs text-slate-500 mt-0.5">Staged provider imports. Nothing is published without an explicit approved decision.</p>
      </div>

      {state.status === 'loading' && <SupplyLoading />}
      {state.status === 'error' && <SupplyError />}
      {state.status === 'empty' && (
        <SupplyEmpty title="No import batches" message="Staged import batches from your supply connections will appear here." />
      )}
      {state.status === 'ready' && (
        <ul className="space-y-3">
          {state.data.map((batch) => (
            <li key={batch.id}>
              <Link
                href={`/dashboard/merchants/${merchant_id}/supply/import-batches/${batch.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{batch.provider}</span>
                  <span className="text-xs text-slate-500">{batch.batch_type}</span>
                  <span className="text-xs font-semibold uppercase rounded px-1.5 py-0.5 bg-slate-100 text-slate-600">{batch.status}</span>
                  {batch.first_import && <span className="text-[10px] font-semibold uppercase rounded px-1.5 py-0.5 bg-blue-100 text-blue-800">first import</span>}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {batch.record_count} records · {batch.approved_count} approved · {batch.rejected_count} rejected · {batch.duplicate_count} duplicates
                </div>
                <div className="text-xs text-slate-400 mt-1">{new Date(batch.created_at).toLocaleString()}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
