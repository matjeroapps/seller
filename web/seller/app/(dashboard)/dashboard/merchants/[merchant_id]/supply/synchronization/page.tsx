'use client';

import { use, useEffect, useState } from 'react';

import { merchantSupplyApi, type SupplyCursor } from '@/lib/api/merchant-console';
import { SupplyEmpty, SupplyError, SupplyLoading } from '@/components/supply/supply-state';

export default function SupplySynchronizationPage({ params }: { params: Promise<{ merchant_id: string }> }) {
  const { merchant_id } = use(params);
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'denied' } | { status: 'error' } | { status: 'empty' } | { status: 'ready'; data: SupplyCursor[] }
  >({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    merchantSupplyApi
      .listCursors(merchant_id, undefined, controller.signal)
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
    <div className="space-y-6" data-testid="supply-synchronization">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Synchronization</h1>
        <p className="text-xs text-slate-500 mt-0.5">Durable per-connection, per-entity sync state and cursors.</p>
      </div>

      {state.status === 'loading' && <SupplyLoading />}
      {state.status === 'error' && <SupplyError />}
      {state.status === 'empty' && <SupplyEmpty title="No synchronization state" message="Sync cursors appear once a connection has synchronized." />}
      {state.status === 'ready' && (
        <ul className="space-y-3">
          {state.data.map((cursor) => (
            <li key={cursor.id} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{cursor.entity_type}</div>
              <div className="text-xs text-slate-500 mt-1">
                Connection {cursor.connection_id.slice(0, 8)}… · cursor {cursor.cursor_token ? cursor.cursor_token.slice(0, 24) : '—'}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Last successful sync {cursor.last_successful_sync ? new Date(cursor.last_successful_sync).toLocaleString() : 'never'}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
