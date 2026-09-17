'use client';

import { useState } from 'react';
import { CreditCard, Clock, CheckCircle2, AlertCircle, ArrowRight, DollarSign } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { Payment } from '@/lib/api/types';

interface PaymentStatusCardProps {
  storeId: string;
  payment: Payment;
  onStatusUpdated: () => void;
}

const statusColors: Record<string, string> = {
  CREATED: 'bg-slate-100 text-slate-800 border-slate-200',
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  AUTHORIZED: 'bg-blue-100 text-blue-800 border-blue-200',
  CAPTURED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  FAILED: 'bg-rose-100 text-rose-800 border-rose-200',
  CANCELLED: 'bg-slate-100 text-slate-800 border-slate-200',
  REFUNDED: 'bg-purple-100 text-purple-800 border-purple-200'
};

const nextAllowedStatuses: Record<string, Array<{ status: 'CAPTURED' | 'FAILED' | 'CANCELLED' | 'REFUNDED'; label: string }>> = {
  CREATED: [
    { status: 'CAPTURED', label: 'Mark Captured (Paid)' },
    { status: 'FAILED', label: 'Mark Failed' },
    { status: 'CANCELLED', label: 'Cancel Payment' }
  ],
  PENDING: [
    { status: 'CAPTURED', label: 'Mark Captured (Paid)' },
    { status: 'FAILED', label: 'Mark Failed' },
    { status: 'CANCELLED', label: 'Cancel Payment' }
  ],
  AUTHORIZED: [
    { status: 'CAPTURED', label: 'Capture Payment' },
    { status: 'CANCELLED', label: 'Cancel Auth' }
  ],
  CAPTURED: [
    { status: 'REFUNDED', label: 'Refund Payment' }
  ]
};

export function PaymentStatusCard({
  storeId,
  payment,
  onStatusUpdated
}: PaymentStatusCardProps) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTransition = async (targetStatus: any) => {
    setError(null);
    setUpdating(true);
    try {
      await sellerApi.updatePaymentStatus(storeId, payment.id, {
        status: targetStatus,
        provider: 'manual',
        provider_reference: `SELLER-ACTION-${targetStatus}`
      });
      setUpdating(false);
      onStatusUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to update payment status');
      setUpdating(false);
    }
  };

  const allowed = nextAllowedStatuses[payment.status] || [];
  const formattedAmount = (payment.amount_minor / 100).toFixed(2);

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-slate-600" />
          <span className="text-xs font-bold text-slate-900">
            Payment #{payment.id.slice(0, 8)}
          </span>
          <span
            className={`px-2 py-0.5 text-[10px] font-semibold border rounded-full uppercase ${
              statusColors[payment.status] || 'bg-slate-100 text-slate-800'
            }`}
          >
            {payment.status}
          </span>
        </div>
        <div className="text-sm font-bold text-slate-900">
          {formattedAmount} {payment.currency}
        </div>
      </div>

      {error && (
        <div className="p-2 text-xs bg-red-50 text-red-700 rounded border border-red-200">
          {error}
        </div>
      )}

      {/* Payment Summary Info */}
      <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded border border-slate-100 flex items-center justify-between">
        <div>
          <span className="font-semibold text-slate-700">Method: </span>
          <span className="font-mono text-slate-900">{payment.payment_method}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-700">Created: </span>
          <span>{new Date(payment.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Action Buttons for Payment Status Transition */}
      {allowed.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
            Payment Actions <ArrowRight className="w-3 h-3" />
          </span>
          <div className="flex flex-wrap gap-1.5">
            {allowed.map((action) => (
              <button
                key={action.status}
                type="button"
                disabled={updating}
                onClick={() => handleTransition(action.status)}
                className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Payment Attempts History */}
      {payment.attempts && payment.attempts.length > 0 && (
        <div className="pt-2 border-t border-slate-100 space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" /> Transaction Attempts
          </div>
          <div className="space-y-1 pl-2 border-l-2 border-slate-200">
            {payment.attempts.map((att) => (
              <div key={att.id} className="text-[11px] text-slate-600 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800">{att.status}</span>
                  <span className="text-slate-500"> ({att.provider})</span>
                  {att.provider_reference && (
                    <span className="text-slate-400 font-mono text-[10px]"> — Ref: {att.provider_reference}</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400">
                  {new Date(att.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
