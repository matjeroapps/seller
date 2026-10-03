'use client';

import { use, useEffect, useState } from 'react';
import { PlugZap } from 'lucide-react';

import { merchantSupplyApi, type SupplyConnection } from '@/lib/api/merchant-console';
import { MerchantAccessDenied } from '@/components/shell/MerchantAccessDenied';
import { SupplyEmpty, SupplyError, SupplyLoading } from '@/components/supply/supply-state';

const statusBadge = (status: string) => {
  const active = status === 'ACTIVE';
  const failure = status === 'ERROR';
  return `text-xs font-semibold uppercase rounded px-1.5 py-0.5 ${
    active ? 'bg-emerald-100 text-emerald-800' : failure ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'
  }`;
};

export default function SupplyConnectionsPage({ params }: { params: Promise<{ merchant_id: string }> }) {
  const { merchant_id } = use(params);
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'denied' } | { status: 'error' } | { status: 'empty' } | { status: 'ready'; data: SupplyConnection[] }
  >({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    merchantSupplyApi
      .listConnections(merchant_id, controller.signal)
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
    <div className="space-y-6" data-testid="supply-connections">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Supply connections</h1>
        <p className="text-xs text-slate-500 mt-0.5">Provider connections owned by this merchant workspace</p>
      </div>

      {state.status === 'loading' && <SupplyLoading />}
      {state.status === 'error' && <SupplyError />}
      {state.status === 'empty' && (
        <SupplyEmpty
          title="No supply connections yet"
          message="Connect a supply source to start importing provider catalog into staging. Nothing is published automatically."
        />
      )}
      {state.status === 'ready' && (
        <ul className="space-y-3">
          {state.data.map((conn) => (
            <li key={conn.id} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <PlugZap aria-hidden="true" className="h-4 w-4 text-slate-500" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{conn.name}</div>
                  <div className="text-xs text-slate-500">
                    {conn.provider} · {conn.connection_type} · health {conn.health_status}
                  </div>
                </div>
                <span className={`ml-auto ${statusBadge(conn.status)}`}>{conn.status}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
