'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, CircleSlash, Package, Store, Truck } from 'lucide-react';

import {
  fetchMerchantConsole,
  hasActiveCapability,
  isOperableWorkspace,
  type MerchantWorkspace
} from '@/lib/api/merchant-console';
import { MerchantAccessDenied } from '@/components/shell/MerchantAccessDenied';

export default function MerchantWorkspacePage({ params }: { params: Promise<{ merchant_id: string }> }) {
  const { merchant_id } = use(params);
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'denied' } | { status: 'error' } | { status: 'ready'; workspace: MerchantWorkspace }
  >({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    fetchMerchantConsole(merchant_id, controller.signal)
      .then((bootstrap) => {
        if (controller.signal.aborted) return;
        const workspace = bootstrap.workspaces.find((ws) => ws.merchant_id === merchant_id);
        if (!workspace || !isOperableWorkspace(workspace)) {
          setState({ status: 'denied' });
          return;
        }
        setState({ status: 'ready', workspace });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [merchant_id]);

  if (state.status === 'loading') {
    return <div className="animate-pulse space-y-3" data-testid="workspace-loading" role="status"><div className="h-8 w-64 bg-slate-200 rounded dark:bg-slate-800" /><div className="h-32 bg-slate-100 rounded dark:bg-slate-900" /></div>;
  }
  if (state.status === 'denied') {
    return (
      <MerchantAccessDenied
        backPath="/dashboard"
        title="Merchant workspace unavailable"
        message="This merchant workspace is not accessible for your account, or your membership is not active."
      />
    );
  }
  if (state.status === 'error') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950" role="alert" data-testid="workspace-error">
        <h1 className="text-base font-semibold text-red-900 dark:text-red-200">Console unavailable</h1>
        <p className="text-sm text-red-700 dark:text-red-300 mt-1">The merchant workspace context could not be loaded.</p>
      </div>
    );
  }

  const ws = state.workspace;
  const retailActive = hasActiveCapability(ws, 'retail');
  const supplyActive = hasActiveCapability(ws, 'supply');
  const retailStatus = ws.capabilities?.retail?.status || 'inactive';
  const supplyStatus = ws.capabilities?.supply?.status || 'inactive';

  return (
    <div className="space-y-6" data-testid="merchant-workspace-overview">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{ws.legal_name}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Merchant workspace · {ws.merchant_code} · {ws.merchant_status}
          </p>
        </div>
        <div className="text-xs text-slate-500">
          Membership <span className="font-semibold text-slate-700 dark:text-slate-300">{ws.membership.status}</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            {retailActive ? (
              <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-emerald-600" />
            ) : (
              <CircleSlash aria-hidden="true" className="h-5 w-5 text-slate-400" />
            )}
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Retail capability</h2>
            <span className={`ml-auto text-xs font-semibold uppercase rounded px-1.5 py-0.5 ${retailActive ? 'bg-emerald-100 text-emerald-800' : retailStatus === 'suspended' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'}`}>
              {retailStatus}
            </span>
          </div>
          {retailActive && ws.stores.length > 0 && (
            <p className="text-xs text-slate-500 mt-2">{ws.stores.length} authorized store{ws.stores.length === 1 ? '' : 's'}</p>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            {supplyActive ? (
              <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-emerald-600" />
            ) : (
              <CircleSlash aria-hidden="true" className="h-5 w-5 text-slate-400" />
            )}
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Supply capability</h2>
            <span className={`ml-auto text-xs font-semibold uppercase rounded px-1.5 py-0.5 ${supplyActive ? 'bg-emerald-100 text-emerald-800' : supplyStatus === 'suspended' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'}`}>
              {supplyStatus}
            </span>
          </div>
          {supplyActive && (
            <Link href={`/dashboard/merchants/${ws.merchant_id}/supply/connections`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
              Open Supply module <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900" data-testid="pending-review-cases">
          <div className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-medium text-slate-500">Open review cases</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">{ws.pending_actions ? ws.pending_actions.open_review_cases : 0}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900" data-testid="unhealthy-connections">
          <div className="flex items-center gap-2">
            <Truck aria-hidden="true" className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-medium text-slate-500">Unhealthy connections</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">{ws.pending_actions ? ws.pending_actions.unhealthy_connections : 0}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900" data-testid="plan-summary">
          <div className="flex items-center gap-2">
            <Package aria-hidden="true" className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500">Plan</span>
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-2">
            {ws.plan_summary ? ws.plan_summary.state : 'UNAVAILABLE'}
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Store aria-hidden="true" className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Authorized stores</h2>
        </div>
        {ws.stores.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900" data-testid="stores-empty">
            <p className="text-sm text-slate-500">No stores are authorized for this workspace yet.</p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ws.stores.map((store) => (
              <li key={store.id}>
                <Link
                  href={`/dashboard/merchants/${ws.merchant_id}/stores/${store.id}`}
                  className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{store.name}</div>
                  <div className="text-xs text-slate-500 mt-1">{store.code} · {store.market_code} · {store.status}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
