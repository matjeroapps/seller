'use client';

import { useState, useEffect, useId, useRef, FormEvent } from 'react';
import { X, Plus, Trash2, Truck, Loader2, Package } from 'lucide-react';
import type { CreateStoreShipmentPayload } from '@/lib/api/types';

export interface CreateShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateStoreShipmentPayload) => Promise<void>;
  loading?: boolean;
  defaultOrderId?: string;
  defaultLocationId?: string;
}

interface ItemRow {
  orderItemId: string;
  quantity: number;
}

export function CreateShipmentModal({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
  defaultOrderId = '',
  defaultLocationId = '',
}: CreateShipmentModalProps) {
  const titleId = useId();
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [orderId, setOrderId] = useState(defaultOrderId);
  const [fulfillmentLocationId, setFulfillmentLocationId] = useState(defaultLocationId || 'loc_main');
  const [carrierName, setCarrierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingCostMajor, setShippingCostMajor] = useState('15');
  const [codAmountMajor, setCodAmountMajor] = useState('0');
  const [currency, setCurrency] = useState('SAR');
  const [items, setItems] = useState<ItemRow[]>([{ orderItemId: '', quantity: 1 }]);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setOrderId(defaultOrderId);
      setFulfillmentLocationId(defaultLocationId || 'loc_main');
      setCarrierName('');
      setTrackingNumber('');
      setShippingCostMajor('15');
      setCodAmountMajor('0');
      setCurrency('SAR');
      setItems([{ orderItemId: '', quantity: 1 }]);
      setValidationError(null);

      const timer = setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, defaultOrderId, defaultLocationId]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems((prev) => [...prev, { orderItemId: '', quantity: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof ItemRow, value: string | number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const cleanOrderId = orderId.trim();
    if (!cleanOrderId) {
      setValidationError('Order ID is required to create a shipment.');
      return;
    }

    const cleanLocationId = fulfillmentLocationId.trim();
    if (!cleanLocationId) {
      setValidationError('Fulfillment location ID is required.');
      return;
    }

    const validItems = items.filter((item) => item.orderItemId.trim() && item.quantity > 0);
    if (validItems.length === 0) {
      setValidationError('At least one shipment item with a valid order item ID and quantity is required.');
      return;
    }

    const shippingCostMinor = Math.round((parseFloat(shippingCostMajor) || 0) * 100);
    const codAmountMinor = Math.round((parseFloat(codAmountMajor) || 0) * 100);

    const payload: CreateStoreShipmentPayload = {
      order_id: cleanOrderId,
      fulfillment_location_id: cleanLocationId,
      carrier_name: carrierName.trim() || undefined,
      tracking_number: trackingNumber.trim() || undefined,
      shipping_cost_minor: shippingCostMinor,
      cod_amount_minor: codAmountMinor,
      currency: currency.trim() || 'SAR',
      items: validItems.map((it) => ({
        order_item_id: it.orderItemId.trim(),
        quantity: it.quantity,
      })),
    };

    try {
      await onSubmit(payload);
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : 'Failed to create shipment.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 id={titleId} className="text-base font-semibold text-slate-900">
                Create Store Shipment
              </h2>
              <p className="text-xs text-slate-500">
                Dispatch an order shipment with optional courier tracking or auto-generated code
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close dialog"
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {validationError && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg" role="alert">
              {validationError}
            </div>
          )}

          {/* Order ID & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="shipment-order-id" className="block text-xs font-semibold text-slate-700 mb-1">
                Order ID <span className="text-rose-500">*</span>
              </label>
              <input
                id="shipment-order-id"
                ref={firstInputRef}
                type="text"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="e.g. ord_01j7..."
                required
                disabled={loading}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="shipment-location-id" className="block text-xs font-semibold text-slate-700 mb-1">
                Fulfillment Location <span className="text-rose-500">*</span>
              </label>
              <input
                id="shipment-location-id"
                type="text"
                value={fulfillmentLocationId}
                onChange={(e) => setFulfillmentLocationId(e.target.value)}
                placeholder="e.g. loc_main"
                required
                disabled={loading}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Carrier & Tracking */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="shipment-carrier" className="block text-xs font-semibold text-slate-700 mb-1">
                Carrier Name <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                id="shipment-carrier"
                type="text"
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
                placeholder="e.g. SMSA Express, Aramex"
                disabled={loading}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="shipment-tracking" className="block text-xs font-semibold text-slate-700 mb-1">
                Tracking Number <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                id="shipment-tracking"
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Leave blank for auto TRK-..."
                disabled={loading}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Leave blank to auto-generate an internal tracking code (<code className="text-indigo-600 font-mono">TRK-...</code>).
              </span>
            </div>
          </div>

          {/* Cost & Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="shipment-cost" className="block text-xs font-semibold text-slate-700 mb-1">
                Shipping Fee ({currency})
              </label>
              <input
                id="shipment-cost"
                type="number"
                step="0.01"
                min="0"
                value={shippingCostMajor}
                onChange={(e) => setShippingCostMajor(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="shipment-cod" className="block text-xs font-semibold text-slate-700 mb-1">
                COD Amount ({currency})
              </label>
              <input
                id="shipment-cod"
                type="number"
                step="0.01"
                min="0"
                value={codAmountMajor}
                onChange={(e) => setCodAmountMajor(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="shipment-currency" className="block text-xs font-semibold text-slate-700 mb-1">
                Currency
              </label>
              <select
                id="shipment-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              >
                <option value="SAR">SAR</option>
                <option value="AED">AED</option>
                <option value="EGP">EGP</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          {/* Shipment Items */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-slate-400" />
                Shipment Line Items <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                disabled={loading}
                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item.orderItemId}
                    onChange={(e) => handleItemChange(idx, 'orderItemId', e.target.value)}
                    placeholder="Order Item ID (e.g. itm_01j...)"
                    required
                    disabled={loading}
                    aria-label={`Order Item ID ${idx + 1}`}
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                    placeholder="Qty"
                    required
                    disabled={loading}
                    aria-label={`Quantity ${idx + 1}`}
                    className="w-16 px-2 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center"
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={loading}
                      aria-label={`Remove Item ${idx + 1}`}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {loading ? 'Creating...' : 'Create Shipment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
