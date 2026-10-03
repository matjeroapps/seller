'use client';

import { use, useEffect, useState } from 'react';

import { merchantSupplyApi, type SupplyMapping } from '@/lib/api/merchant-console';
import { SupplyEmpty, SupplyError, SupplyLoading } from '@/components/supply/supply-state';

export default function SupplyMappingsPage({ params }: { params: Promise<{ merchant_id: string }> }) {
  const { merchant_id } = use(params);
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'denied' } | { status: 'error' } | { status: 'empty' } | { status: 'ready'; data: SupplyMapping[] }
  >({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    merchantSupplyApi
      .listMappings(merchant_id, undefined, controller.signal)
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
    <div className="space-y-6" data-testid="supply-mappings">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Mappings</h1>
        <p className="text-xs text-slate-500 mt-0.5">Approved entity correlations with their authority and provenance, exactly as persisted.</p>
      </div>

      {state.status === 'loading' && <SupplyLoading />}
      {state.status === 'error' && <SupplyError />}
      {state.status === 'empty' && <SupplyEmpty title="No mappings" message="Approved mappings between external entities and MatjerHub records will appear here." />}
      {state.status === 'ready' && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Entity type</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Internal ID</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">External product</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Authority</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Status</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Last synced</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
              {state.data.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{m.entity_type}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{m.internal_id}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{m.external_product_id}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{m.authority_source}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{m.status}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{m.last_synced_at ? new Date(m.last_synced_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
