'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected dashboard boundary errors for observability
    console.error('Dashboard segment error boundary caught:', error);
  }, [error]);

  return (
    <div
      role="alert"
      className="p-8 max-w-lg mx-auto my-12 bg-white rounded-2xl border border-rose-200 shadow-xl space-y-5 text-center animate-in fade-in zoom-in-95 duration-150"
    >
      <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-100">
        <AlertTriangle className="w-6 h-6" aria-hidden="true" />
      </div>

      <div className="space-y-1.5">
        <h2 className="text-base font-bold text-slate-900">
          Something went wrong in this section
        </h2>
        <p className="text-xs text-slate-500">
          {error.message || 'An unexpected error occurred while loading this dashboard view.'}
        </p>
      </div>

      {error.digest && (
        <div className="text-[10px] font-mono text-slate-400 bg-slate-50 py-1 px-2 rounded border border-slate-100">
          Error Digest: {error.digest}
        </div>
      )}

      <div className="flex items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => reset()}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try Again
        </button>
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
          Dashboard Home
        </Link>
      </div>
    </div>
  );
}
