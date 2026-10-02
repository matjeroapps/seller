import React from 'react';
import Link from 'next/link';
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Info, Lock, RefreshCw, XCircle } from 'lucide-react';
import type { CapabilityStateInfo, CapabilityStatus } from '@/lib/screens/state';

interface CapabilityStateProps {
  state: CapabilityStateInfo;
  className?: string;
  children?: React.ReactNode;
}

const STATUS_ICONS: Record<CapabilityStatus, React.ComponentType<{ className?: string }>> = {
  loading: RefreshCw,
  live: CheckCircle2,
  empty: Info,
  blocked: Lock,
  'setup-required': AlertTriangle,
  unavailable: AlertCircle,
  'manual-review': Clock,
  error: XCircle,
};

const STATUS_COLOR_CLASSES: Record<CapabilityStatus, string> = {
  loading: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
  live: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  empty: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800',
  blocked: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  'setup-required': 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  unavailable: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-700',
  'manual-review': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900',
  error: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
};

export function CapabilityState({ state, className = '', children }: CapabilityStateProps) {
  if (state.status === 'live' && children) {
    return <>{children}</>;
  }

  const IconComponent = STATUS_ICONS[state.status] || Info;
  const colorClass = STATUS_COLOR_CLASSES[state.status] || STATUS_COLOR_CLASSES.empty;

  return (
    <div
      role="region"
      aria-label={`${state.title} (${state.status})`}
      data-capability-status={state.status}
      className={`rounded-lg border p-6 text-start shadow-sm transition-colors ${colorClass} ${className}`}
    >
      <div className="flex items-start gap-4">
        <div className="mt-0.5 shrink-0">
          <IconComponent
            aria-hidden="true"
            className={`h-6 w-6 ${state.status === 'loading' ? 'animate-spin text-blue-600' : ''}`}
          />
        </div>
        <div className="flex-1 space-y-1">
          <h3 className="text-base font-semibold leading-6">{state.title}</h3>
          <p className="text-sm opacity-90">{state.description}</p>
          {state.reason && (
            <p className="text-xs font-mono opacity-75 mt-1">Reason: {state.reason}</p>
          )}

          <div className="pt-3 flex flex-wrap items-center gap-3">
            {state.retryable && state.onRetry && (
              <button
                type="button"
                onClick={state.onRetry}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:ring-slate-700"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retry Request
              </button>
            )}

            {state.actionText && state.actionHref && (
              <Link
                href={state.actionHref}
                className="inline-flex items-center rounded-md bg-primary-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
              >
                {state.actionText}
              </Link>
            )}

            {state.actionText && state.onAction && !state.actionHref && (
              <button
                type="button"
                onClick={state.onAction}
                className="inline-flex items-center rounded-md bg-primary-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-500"
              >
                {state.actionText}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
