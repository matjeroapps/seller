'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';

import { merchantSupplyApi, type SupplyFulfillmentRequestDetail } from '@/lib/api/merchant-console';
import { SupplyEmpty, SupplyError, SupplyLoading } from '@/components/supply/supply-state';

export default function SupplyFulfillmentDetailPage({
  params
}: {
  params: Promise<{ merchant_id: string; request_id: string }>;
}) {
  const { merchant_id, request_id } = use(params);
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'denied' } | { status: 'error' } | { status: 'empty' } | { status: 'ready'; data: SupplyFulfillmentRequestDetail }
  >({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    merchantSupplyApi
      .getFulfillmentRequest(merchant_id, request_id, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setState(data.tracking_events.length === 0 ? { status: 'empty' } : { status: 'ready', data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [merchant_id, request_id]);

  return (
    <div className="space-y-6" data-testid="supply-fulfillment-detail">
      <Link
        href={`/dashboard/merchants/${merchant_id}/supply/fulfillment`}
        className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        ← Fulfillment
      </Link>

      {state.status === 'loading' && <SupplyLoading />}
      {state.status === 'error' && <SupplyError />}
      {state.status === 'empty' && <SupplyEmpty title="No tracking events" message="This fulfillment request has no imported tracking events yet." />}
      {state.status === 'ready' && (
        <>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{state.data.request.provider}</h1>
            <p className="text-xs text-slate-500 mt-1">
              Status <span className="font-semibold">{state.data.request.status}</span>
              {state.data.request.external_fulfillment_id ? ` · external ${state.data.request.external_fulfillment_id}` : ''}
            </p>
          </div>
          <ol className="space-y-3">
            {state.data.tracking_events.map((event) => (
              <li key={event.id} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{event.status}</span>
                  {event.carrier && <span className="text-xs text-slate-500">{event.carrier}</span>}
                  {event.tracking_number && <span className="text-xs text-slate-500">{event.tracking_number}</span>}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {event.occurred_at ? new Date(event.occurred_at).toLocaleString() : new Date(event.created_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
