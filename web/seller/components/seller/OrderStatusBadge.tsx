import type { ReactNode } from 'react';
import { CheckCircle2, Clock, Package, Truck, XCircle } from 'lucide-react';
import enDict from '@/locales/en.json';

function resolveDictionaryKey(obj: unknown, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

type Translator = (key: string, fallback?: string) => string;

// Out-of-context default: same English dictionary fallback as useTranslation's
// no-provider path, so legacy getStatusBadge callers keep rendering English.
const defaultTranslator: Translator = (key, fallback) =>
  resolveDictionaryKey(enDict, key) ?? fallback ?? key;

const ORDER_STATUS_LABEL_KEYS: Record<string, string> = {
  pending: 'orders.statusPending',
  confirmed: 'orders.statusConfirmed',
  processing: 'orders.statusProcessing',
  ready_for_shipping: 'orders.statusReadyForShipping',
  shipped: 'orders.statusShipped',
  delivered: 'orders.statusDelivered',
  cancelled: 'orders.statusCancelled'
};

const ORDER_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  confirmed: 'bg-blue-50 text-blue-700 border border-blue-200',
  processing: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  ready_for_shipping: 'bg-purple-50 text-purple-700 border border-purple-200',
  shipped: 'bg-sky-50 text-sky-700 border border-sky-200',
  delivered: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 border border-rose-200'
};

const ORDER_STATUS_ICONS: Record<string, ReactNode> = {
  pending: <Clock className="w-3 h-3" />,
  confirmed: <CheckCircle2 className="w-3 h-3" />,
  processing: <Package className="w-3 h-3" />,
  ready_for_shipping: <Package className="w-3 h-3" />,
  shipped: <Truck className="w-3 h-3" />,
  delivered: <CheckCircle2 className="w-3 h-3" />,
  cancelled: <XCircle className="w-3 h-3" />
};

export function getStatusBadge(status: string, t: Translator = defaultTranslator) {
  const normalized = status.toLowerCase();
  const styles =
    ORDER_STATUS_STYLES[normalized] ||
    'bg-slate-100 text-slate-700 border border-slate-200';
  const suffix = ORDER_STATUS_ICONS[normalized];
  const label = ORDER_STATUS_LABEL_KEYS[normalized]
    ? t(ORDER_STATUS_LABEL_KEYS[normalized], status)
    : status;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${styles}`}>
      {suffix} {label}
    </span>
  );
}
