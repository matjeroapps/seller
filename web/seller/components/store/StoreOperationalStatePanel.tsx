'use client';

import { PauseCircle, PlayCircle, ShieldAlert } from 'lucide-react';
import type { StoreOperationalState } from '@/lib/api/types';

type StoreOperationalStatePanelProps = {
  state: StoreOperationalState | null;
  maintenanceMessage: string;
  isSaving: boolean;
  onMaintenanceMessageChange: (value: string) => void;
  onToggle: () => void;
};

export function StoreOperationalStatePanel({
  state,
  maintenanceMessage,
  isSaving,
  onMaintenanceMessageChange,
  onToggle
}: StoreOperationalStatePanelProps) {
  const accepting = state?.checkout_accepting ?? true;

  return (
    <section className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4" aria-labelledby="checkout-operations-heading">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-lg border ${accepting ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 id="checkout-operations-heading" className="text-sm font-bold text-slate-900">Checkout operations</h2>
            <p className="text-xs text-slate-500 mt-1">
              Pause new checkout acceptance while keeping the customer catalog available for browsing.
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${accepting ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {accepting ? 'Accepting orders' : 'Checkout paused'}
        </span>
      </div>

      {!accepting && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
          Shoppers can browse products, but checkout is temporarily unavailable.
        </div>
      )}

      <label className="block">
        <span className="block text-xs font-semibold text-slate-700 mb-1.5">Customer message</span>
        <textarea
          value={maintenanceMessage}
          onChange={(event) => onMaintenanceMessageChange(event.target.value)}
          rows={2}
          maxLength={240}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          placeholder="Checkout is temporarily unavailable. Please try again later."
        />
      </label>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-slate-500">
          {state?.updated_at ? `Last changed ${new Date(state.updated_at).toLocaleString()}` : 'Default checkout state is enabled.'}
        </p>
        <button
          type="button"
          onClick={onToggle}
          disabled={isSaving}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-white shadow-xs disabled:cursor-not-allowed disabled:opacity-60 ${accepting ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
        >
          {accepting ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
          {isSaving ? 'Saving...' : accepting ? 'Pause checkout' : 'Resume checkout'}
        </button>
      </div>
    </section>
  );
}
