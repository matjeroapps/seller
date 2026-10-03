import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';

/**
 * Explicit access-denied state for merchant-scoped surfaces (Feature 025).
 * Rendered when the workspace or resource is not authorized for the current
 * principal — never a fallback to another merchant or a guessed workspace.
 */
export function MerchantAccessDenied({
  title = 'Access denied',
  message = 'You do not have an active membership or permission for this merchant workspace.',
  backPath
}: {
  title?: string;
  message?: string;
  backPath?: string;
}) {
  return (
    <div className="space-y-4" data-testid="merchant-access-denied" role="alert">
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950">
        <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{message}</p>
          {backPath && (
            <Link
              href={backPath}
              className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Back to dashboard
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
