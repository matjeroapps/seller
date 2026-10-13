import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export const productEditorInputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100';

export const productEditorCardClass =
  'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6';

export function ProductEditorLayout({ children }: { children: ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-[#f8f9ff] pb-24 text-slate-900">
      <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}

export function ProductEditorHeading({
  icon: Icon,
  title,
  hint,
  required,
  children,
  className = '',
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  required?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>
        </div>
      </div>
      {required && (
        <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
          إجباري
        </span>
      )}
      {children}
    </div>
  );
}

export function ProductEditorSection(props: Parameters<typeof ProductEditorHeading>[0]) {
  return <section className={`${productEditorCardClass} ${props.className || ''}`}><ProductEditorHeading {...props} /></section>;
}
