'use client';

import { useState } from 'react';
import { Truck, X } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { CreateShipmentPayload } from '@/lib/api/types';

interface OrderItemOption {
  id: string;
  product_name: string;
  sku_code: string;
  quantity: number;
}

interface FulfillmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  orderId: string;
  orderItems: OrderItemOption[];
  currency: string;
  onShipmentCreated: () => void;
}

export function FulfillmentModal({
  isOpen,
  onClose,
  storeId,
  orderId,
  orderItems,
  currency,
  onShipmentCreated
}: FulfillmentModalProps) {
  const [fulfillmentLocationId, setFulfillmentLocationId] = useState('loc_dev_01');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingCost, setShippingCost] = useState('0');
  const [codAmount, setCodAmount] = useState('0');
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    orderItems.forEach((item) => {
      initial[item.id] = item.quantity;
    });
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleQuantityChange = (itemId: string, val: number) => {
    setItemQuantities((prev) => ({
      ...prev,
      [itemId]: Math.max(0, val)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const itemsToShip = Object.entries(itemQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => ({
        order_item_id: itemId,
        quantity: qty
      }));

    if (itemsToShip.length === 0) {
      setError('Please select at least one item quantity to fulfill.');
      setSubmitting(false);
      return;
    }

    const payload: CreateShipmentPayload = {
      fulfillment_location_id: fulfillmentLocationId,
      tracking_number: trackingNumber,
      shipping_cost_minor: Math.round(parseFloat(shippingCost || '0') * 100),
      cod_amount_minor: Math.round(parseFloat(codAmount || '0') * 100),
      currency: currency || 'SAR',
      items: itemsToShip
    };

    try {
      await sellerApi.createShipment(storeId, orderId, payload);
      setSubmitting(false);
      onShipmentCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create shipment');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <Truck className="w-5 h-5 text-indigo-600" />
            <span>Fulfill Order Items</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 text-xs bg-red-50 text-red-700 rounded-md border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Fulfillment Location ID
            </label>
            <input
              type="text"
              value={fulfillmentLocationId}
              onChange={(e) => setFulfillmentLocationId(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tracking Number
              </label>
              <input
                type="text"
                placeholder="e.g. AWB-987654"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Shipping Cost ({currency})
              </label>
              <input
                type="number"
                step="0.01"
                value={shippingCost}
                onChange={(e) => setShippingCost(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Items to Ship
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 p-2 rounded-md">
              {orderItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-b-0">
                  <div>
                    <div className="font-medium text-slate-900">{item.product_name}</div>
                    <div className="text-[10px] text-slate-500">SKU: {item.sku_code}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-[11px]">Qty:</span>
                    <input
                      type="number"
                      min={0}
                      max={item.quantity}
                      value={itemQuantities[item.id] ?? item.quantity}
                      onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                      className="w-14 px-2 py-0.5 text-xs border border-slate-300 rounded text-center"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50"
            >
              {submitting ? 'Creating Shipment...' : 'Create Shipment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
