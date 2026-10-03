'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';

import { merchantSupplyApi, type SupplyFulfillmentRequest } from '@/lib/api/merchant-console';
import { SupplyEmpty, SupplyError, SupplyLoading } from '@/components/supply/supply-state';

export default function SupplyFulfillmentPage({ params }: { params: Promise<{ merchant_id: string }> }) {
  const { merchant_id } = use(params);
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'denied' } | { status: 'error' } | { status: 'empty' } | { status: 'ready'; data: SupplyFulfillmentRequest[] }
  >({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    merchantSupplyApi
      .listFulfillmentRequests(merchant_id, {}, controller.signal)
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
    <div className="space-y-6" data-testid="supply-fulfillment">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Fulfillment</h1>
        <p className="text-xs text-slate-500 mt-0.5">Outbound supplier fulfillment requests and their imported tracking state.</p>
      </div>

      {state.status === 'loading' && <SupplyLoading />}
      {state.status === 'error' && <SupplyError />}
      {state.status === 'empty' && <SupplyEmpty title="No fulfillment requests" message="Fulfillment requests routed to suppliers will appear here." />}
      {state.status === 'ready' && (
        <ul className="space-y-3">
          {state.data.map((request) => (
            <li key={request.id}>
              <Link
                href={`/dashboard/merchants/${merchant_id}/supply/fulfillment/${request.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{request.provider}</span>
                  <span className="text-xs font-semibold uppercase rounded px-1.5 py-0.5 bg-slate-100 text-slate-600">{request.status}</span>
                  {request.external_fulfillment_id && (
                    <span className="text-xs text-slate-500">external {request.external_fulfillment_id}</span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-1">{new Date(request.created_at).toLocaleString()}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
