'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Truck,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  MapPin,
  Calendar,
  FileText,
  DollarSign,
  Send,
  Ban,
  RefreshCw
} from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { SellerOrderDetail } from '@/lib/api/types';
import { getStatusBadge } from '../page';

export default function StoreOrderDetailPage({
  params
}: {
  params: Promise<{ store_id: string; order_id: string }> | { store_id: string; order_id: string };
}) {
  const unwrappedParams =
    params && typeof (params as unknown as Promise<{ store_id: string; order_id: string }>).then === 'function'
      ? use(params as Promise<{ store_id: string; order_id: string }>)
      : (params as unknown as { store_id: string; order_id: string }) || {};
  const { store_id, order_id } = unwrappedParams;

  const [order, setOrder] = useState<SellerOrderDetail>(() => ({
    id: order_id || 'ord_dev_01',
    order_number: 'ORD-DEV-001',
    status: 'ready_for_shipping',
    currency: 'SAR',
    subtotal: 15000,
    total: 16500,
    item_count: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    contact_email: 'dev@example.com',
    shipping_address: { recipient_name: 'Dev Customer', address_line_1: 'King Fahd Rd', city: 'Riyadh', country_code: 'SA', phone: '+966500000000' },
    items: [
      { id: 'item_dev_01', product_name: 'Sample Product A', sku_code: 'SKU-PROD-A', quantity: 2, unit_price: 5000, total_price: 10000, source: 'seller_owned' },
      { id: 'item_dev_02', product_name: 'Sample Product B', sku_code: 'SKU-PROD-B', quantity: 1, unit_price: 5000, total_price: 5000, source: 'seller_owned' }
    ],
    timeline: [
      { id: 't1', type: 'confirmed', detail: 'Order confirmed', created_at: new Date().toISOString() }
    ],
    allowed_next_actions: ['shipped', 'cancelled']
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal States
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isFulfillmentModalOpen, setIsFulfillmentModalOpen] = useState(false);
  const [carrierName, setCarrierName] = useState('Local Courier');
  const [trackingReference, setTrackingReference] = useState('');
  const [fulfillmentNotes, setFulfillmentNotes] = useState('');

  const fetchOrderDetail = async () => {
    if (!store_id || !order_id) return;
    setError(null);
    try {
      const data = await sellerApi.getStoreOrderDetail(store_id, order_id);
      setOrder(data);
    } catch (err: unknown) {
      if (!order_id.startsWith('ord_dev')) {
        const msg = err instanceof Error ? err.message : 'Failed to load order details';
        setError(msg);
      }
    }
  };

  useEffect(() => {
    fetchOrderDetail();
  }, [store_id, order_id]);

  const handleTransition = async (targetStatus: string, reasonText?: string) => {
    setActionLoading(true);
    setError(null);
    try {
      const updated = await sellerApi.transitionStoreOrder(store_id, order_id, {
        target_status: targetStatus,
        reason: reasonText
      });
      setOrder(updated);
      setIsCancelModalOpen(false);
      setIsFulfillmentModalOpen(false);
      setCancelReason('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to transition order';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFulfillSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const reasonPayload = `Carrier: ${carrierName}, Tracking: ${trackingReference || 'N/A'}${
      fulfillmentNotes ? ` - Notes: ${fulfillmentNotes}` : ''
    }`;
    handleTransition('shipped', reasonPayload);
  };

  if (loading) {
    return (
      <div className="max-w-4xl p-12 text-center text-xs text-slate-500 space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400" />
        <div>Loading order details...</div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="max-w-4xl space-y-4">
        <Link
          href={`/dashboard/stores/${store_id}/orders`}
          className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Orders
        </Link>
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-3 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const formattedCreated = new Date(order.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const currency = order.currency || 'SAR';
  const subtotalFormatted = (order.subtotal / 100).toFixed(2);
  const totalFormatted = (order.total / 100).toFixed(2);
  const shippingFormatted = ((order.total - order.subtotal) / 100).toFixed(2);

  const canCancel = ['pending', 'confirmed', 'processing'].includes(order.status);
  const canProcess = order.status === 'confirmed';
  const canReadyForShipping = order.status === 'processing';
  const canShip = order.status === 'ready_for_shipping';
  const canDeliver = order.status === 'shipped';

  return (
    <div className="max-w-4xl space-y-6">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href={`/dashboard/stores/${store_id}/orders`}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Orders
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Order Fulfillment & Tracking — #{order.order_number || order.id.slice(0, 8)}
            </h1>
            {getStatusBadge(order.status)}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Placed on {formattedCreated} • ID: <span className="font-mono">{order.id}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {canProcess && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleTransition('processing')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm disabled:opacity-50"
            >
              <Package className="w-3.5 h-3.5" /> Start Processing
            </button>
          )}

          {canReadyForShipping && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleTransition('ready_for_shipping')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-md shadow-sm disabled:opacity-50"
            >
              <Package className="w-3.5 h-3.5" /> Mark Ready for Shipping
            </button>
          )}

          {canShip && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => setIsFulfillmentModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-md shadow-sm disabled:opacity-50"
            >
              <Truck className="w-3.5 h-3.5" /> Create Shipment
            </button>
          )}

          {canDeliver && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleTransition('delivered')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-sm disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Delivery
            </button>
          )}

          {canCancel && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => setIsCancelModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md shadow-sm disabled:opacity-50"
            >
              <Ban className="w-3.5 h-3.5" /> Cancel Order
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-3 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid: Details & Customer info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Line Items & Totals (2 cols) */}
        <div className="md:col-span-2 space-y-6">
          {/* Items Card */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Order Items ({order.items?.length || 0})
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {order.items?.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between text-xs gap-4">
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-900">{item.product_name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">SKU: {item.sku_code}</div>
                    <div className="text-[10px] text-slate-400 capitalize">Source: {item.source?.replace('_', ' ')}</div>
                  </div>
                  <div className="text-end whitespace-nowrap">
                    <div className="font-semibold text-slate-900">
                      {(item.total_price / 100).toFixed(2)} {currency}
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      {item.quantity} × {(item.unit_price / 100).toFixed(2)} {currency}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals Summary */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{subtotalFormatted} {currency}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Estimated Shipping</span>
                <span>{shippingFormatted} {currency}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                <span>Total Amount</span>
                <span>{totalFormatted} {currency}</span>
              </div>
            </div>
          </div>

          {/* Timeline Card */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-4">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Activity & Fulfillment Timeline
            </h2>
            <div className="space-y-3">
              {order.timeline?.map((entry, idx) => {
                const date = new Date(entry.created_at).toLocaleTimeString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });
                return (
                  <div key={entry.id || idx} className="flex items-start gap-3 text-xs">
                    <div className="w-2 h-2 rounded-full bg-indigo-600 mt-1.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-medium text-slate-900 capitalize">
                        {entry.type?.replace('_', ' ')}
                      </div>
                      <div className="text-slate-500 text-[11px]">{entry.detail}</div>
                    </div>
                    <div className="text-slate-400 text-[10px] whitespace-nowrap">{date}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Customer & Shipping (1 col) */}
        <div className="space-y-6">
          {/* Customer Card */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-3">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              Customer Contact
            </h2>
            <div className="text-xs space-y-1">
              <div className="font-semibold text-slate-900">
                {order.shipping_address?.recipient_name || 'Guest Customer'}
              </div>
              {order.contact_email && (
                <div className="text-slate-600">{order.contact_email}</div>
              )}
              {order.shipping_address?.phone && (
                <div className="text-slate-600">{order.shipping_address.phone}</div>
              )}
            </div>
          </div>

          {/* Shipping Address Card */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-3">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              Delivery Address
            </h2>
            {order.shipping_address ? (
              <div className="text-xs text-slate-600 space-y-0.5">
                <div className="font-medium text-slate-900">
                  {order.shipping_address.recipient_name}
                </div>
                <div>{order.shipping_address.address_line_1}</div>
                {order.shipping_address.address_line_2 && (
                  <div>{order.shipping_address.address_line_2}</div>
                )}
                <div>
                  {[order.shipping_address.city, order.shipping_address.region, order.shipping_address.country_code]
                    .filter(Boolean)
                    .join(', ')}
                </div>
                {order.shipping_address.postal_code && (
                  <div className="font-mono text-slate-500">{order.shipping_address.postal_code}</div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-400">No address provided</div>
            )}
          </div>
        </div>
      </div>

      {/* Cancellation Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Cancel Order #{order.order_number || order.id.slice(0, 8)}</h3>
            <p className="text-xs text-slate-500">
              Cancelling this order will release all reserved inventory items back to catalog stock. This action is permanent.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Cancellation Reason (Required)
              </label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Customer requested cancellation before shipping..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-md p-2 focus:ring-1 focus:ring-rose-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={actionLoading || !cancelReason.trim()}
                onClick={() => handleTransition('cancelled', cancelReason)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md disabled:opacity-50"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Fulfillment Modal */}
      {isFulfillmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={handleFulfillSubmit} className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-sky-600" />
              Manual Package Dispatch & Fulfillment
            </h3>
            <p className="text-xs text-slate-500">
              Record carrier and tracking details before marking the order as shipped.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Carrier / Courier Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Local Courier, Fetchr, Aramex"
                  value={carrierName}
                  onChange={(e) => setCarrierName(e.target.value)}
                  className="w-full border border-slate-200 rounded-md p-2 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Tracking Code / Waybill</label>
                <input
                  type="text"
                  placeholder="e.g. TRK-987654321"
                  value={trackingReference}
                  onChange={(e) => setTrackingReference(e.target.value)}
                  className="w-full border border-slate-200 rounded-md p-2 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Operational Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Handed over to driver in morning batch"
                  value={fulfillmentNotes}
                  onChange={(e) => setFulfillmentNotes(e.target.value)}
                  className="w-full border border-slate-200 rounded-md p-2 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsFulfillmentModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading || !carrierName.trim()}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-md disabled:opacity-50"
              >
                Mark as Shipped
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
