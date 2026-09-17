'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Truck, Package, Clock, CreditCard } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { Shipment, Payment } from '@/lib/api/types';
import { FulfillmentModal } from '@/components/shell/FulfillmentModal';
import { ShipmentTimelineCard } from '@/components/shell/ShipmentTimelineCard';
import { PaymentStatusCard } from '@/components/shell/PaymentStatusCard';

export default function StoreOrderDetailPage({
  params
}: {
  params: Promise<{ store_id: string; order_id: string }>;
}) {
  const { store_id, order_id } = use(params);

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFulfillmentOpen, setIsFulfillmentOpen] = useState(false);

  // Mock order items for demonstration / fulfillment integration
  const mockOrderItems = [
    { id: 'item_dev_01', product_name: 'Sample Product A', sku_code: 'SKU-PROD-A', quantity: 2 },
    { id: 'item_dev_02', product_name: 'Sample Product B', sku_code: 'SKU-PROD-B', quantity: 1 }
  ];

  const fetchOrderDetails = () => {
    setLoading(true);
    Promise.all([
      sellerApi.listOrderShipments(store_id, order_id).catch(() => ({ shipments: [] })),
      sellerApi.getOrderPayment(store_id, order_id).catch(() => null)
    ]).then(([shipmentsRes, paymentRes]) => {
      setShipments(shipmentsRes.shipments || []);
      setPayment(paymentRes);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchOrderDetails();
  }, [store_id, order_id]);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header & Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/stores/${store_id}`}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
            </Link>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">
            Order Fulfillment & Tracking — #{order_id.slice(0, 8)}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage shipments, update shipping status timeline, and track customer delivery.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsFulfillmentOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm"
        >
          <Truck className="w-4 h-4" /> Create Shipment
        </button>
      </div>

      {/* Order Items Overview */}
      <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm space-y-3">
        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Order Items Summary
        </h2>
        <div className="divide-y divide-slate-100">
          {mockOrderItems.map((item) => (
            <div key={item.id} className="py-2 flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold text-slate-900">{item.product_name}</div>
                <div className="text-[10px] text-slate-500 font-mono">SKU: {item.sku_code}</div>
              </div>
              <div className="text-slate-700 font-medium">Qty: {item.quantity}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Overview */}
      {payment && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <span>Order Payment Status</span>
          </h2>
          <PaymentStatusCard
            storeId={store_id}
            payment={payment}
            onStatusUpdated={fetchOrderDetails}
          />
        </div>
      )}

      {/* Shipments & Tracking Timeline */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Package className="w-4 h-4 text-indigo-600" />
          <span>Shipments ({shipments.length})</span>
        </h2>

        {loading ? (
          <div className="p-6 bg-white border border-slate-200 rounded-lg text-xs text-slate-500 animate-pulse">
            Loading order shipments...
          </div>
        ) : shipments.length === 0 ? (
          <div className="p-8 bg-white border border-slate-200 rounded-lg text-center space-y-2">
            <Truck className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="text-xs font-medium text-slate-700">No shipments created yet</div>
            <div className="text-[11px] text-slate-500">
              Click &quot;Create Shipment&quot; above to fulfill order items and generate tracking information.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {shipments.map((shp) => (
              <ShipmentTimelineCard
                key={shp.id}
                storeId={store_id}
                shipment={shp}
                onStatusUpdated={fetchOrderDetails}
              />
            ))}
          </div>
        )}
      </div>

      {/* Fulfillment Modal Dialog */}
      <FulfillmentModal
        isOpen={isFulfillmentOpen}
        onClose={() => setIsFulfillmentOpen(false)}
        storeId={store_id}
        orderId={order_id}
        orderItems={mockOrderItems}
        currency="SAR"
        onShipmentCreated={fetchOrderDetails}
      />
    </div>
  );
}
