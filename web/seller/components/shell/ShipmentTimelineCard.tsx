'use client';

import { useState } from 'react';
import { Package, Clock, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { Shipment } from '@/lib/api/types';

interface ShipmentTimelineCardProps {
  storeId: string;
  shipment: Shipment;
  onStatusUpdated: () => void;
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  PROCESSING: 'bg-blue-100 text-blue-800 border-blue-200',
  READY_FOR_PICKUP: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  SHIPPED: 'bg-purple-100 text-purple-800 border-purple-200',
  OUT_FOR_DELIVERY: 'bg-sky-100 text-sky-800 border-sky-200',
  DELIVERED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  FAILED: 'bg-rose-100 text-rose-800 border-rose-200',
  RETURNED: 'bg-slate-100 text-slate-800 border-slate-200'
};

const nextAllowedStatuses: Record<string, Array<{ status: 'PENDING' | 'PROCESSING' | 'READY_FOR_PICKUP' | 'SHIPPED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'RETURNED'; label: string }>> = {
  PENDING: [
    { status: 'PROCESSING', label: 'Mark Processing' },
    { status: 'FAILED', label: 'Mark Failed' }
  ],
  PROCESSING: [
    { status: 'READY_FOR_PICKUP', label: 'Ready for Pickup' },
    { status: 'SHIPPED', label: 'Mark Shipped' },
    { status: 'FAILED', label: 'Mark Failed' }
  ],
  READY_FOR_PICKUP: [
    { status: 'SHIPPED', label: 'Mark Shipped' },
    { status: 'FAILED', label: 'Mark Failed' }
  ],
  SHIPPED: [
    { status: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
    { status: 'DELIVERED', label: 'Mark Delivered' },
    { status: 'FAILED', label: 'Mark Failed' },
    { status: 'RETURNED', label: 'Mark Returned' }
  ],
  OUT_FOR_DELIVERY: [
    { status: 'DELIVERED', label: 'Mark Delivered' },
    { status: 'FAILED', label: 'Mark Failed' },
    { status: 'RETURNED', label: 'Mark Returned' }
  ],
  FAILED: [
    { status: 'PROCESSING', label: 'Retry Processing' },
    { status: 'RETURNED', label: 'Mark Returned' }
  ]
};

export function ShipmentTimelineCard({
  storeId,
  shipment,
  onStatusUpdated
}: ShipmentTimelineCardProps) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTransition = async (targetStatus: any) => {
    setError(null);
    setUpdating(true);
    try {
      await sellerApi.updateShipmentStatus(storeId, shipment.id, {
        status: targetStatus,
        tracking_number: shipment.tracking_number,
        notes: `Status changed to ${targetStatus}`
      });
      setUpdating(false);
      onStatusUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
      setUpdating(false);
    }
  };

  const allowed = nextAllowedStatuses[shipment.status] || [];

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-slate-600" />
          <span className="text-xs font-bold text-slate-900">
            Shipment #{shipment.id.slice(0, 8)}
          </span>
          <span
            className={`px-2 py-0.5 text-[10px] font-semibold border rounded-full uppercase ${
              statusColors[shipment.status] || 'bg-slate-100 text-slate-800'
            }`}
          >
            {shipment.status.replace(/_/g, ' ')}
          </span>
        </div>
        {shipment.tracking_number && (
          <div className="text-xs text-slate-600 font-mono">
            Tracking: <span className="font-semibold text-slate-900">{shipment.tracking_number}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-2 text-xs bg-red-50 text-red-700 rounded border border-red-200">
          {error}
        </div>
      )}

      {/* Shipment Items List */}
      <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-2 rounded border border-slate-100">
        <div className="font-semibold text-slate-800 text-[11px] mb-1">Items Shipped:</div>
        {shipment.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between text-[11px]">
            <span>Item #{item.order_item_id.slice(0, 8)}</span>
            <span className="font-medium">Qty: {item.quantity}</span>
          </div>
        ))}
      </div>

      {/* Action Buttons for Status Transition */}
      {allowed.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
            Status Actions <ArrowRight className="w-3 h-3" />
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

      {/* Event Timeline */}
      {shipment.events && shipment.events.length > 0 && (
        <div className="pt-2 border-t border-slate-100 space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" /> Timeline Events
          </div>
          <div className="space-y-1 pl-2 border-l-2 border-slate-200">
            {shipment.events.map((ev) => (
              <div key={ev.id} className="text-[11px] text-slate-600 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800">{ev.status.replace(/_/g, ' ')}</span>
                  {ev.notes && <span className="text-slate-500"> — {ev.notes}</span>}
                </div>
                <span className="text-[10px] text-slate-400">
                  {new Date(ev.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
