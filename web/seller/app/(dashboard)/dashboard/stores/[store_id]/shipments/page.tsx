'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Truck, Package, Clock, ExternalLink } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { Shipment } from '@/lib/api/types';
import { ShipmentTimelineCard } from '@/components/shell/ShipmentTimelineCard';

export default function StoreShipmentsPage({
  params
}: {
  params: Promise<{ store_id: string }>;
}) {
  const { store_id } = use(params);

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const fetchStoreShipments = () => {
    setLoading(true);
    // Fetch shipments for default/dev order or list order shipments
    sellerApi
      .listOrderShipments(store_id, 'ord_dev_01')
      .then((res) => {
        setShipments(res.shipments || []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchStoreShipments();
  }, [store_id]);

  const filteredShipments = statusFilter === 'ALL'
    ? shipments
    : shipments.filter((s) => s.status === statusFilter);

  const filterOptions = ['ALL', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'FAILED'];

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Store Shipments Overview</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          View and manage physical fulfillment shipments and tracking status for this store.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2">
        {filterOptions.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setStatusFilter(opt)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              statusFilter === opt
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {opt.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Shipments Content */}
      {loading ? (
        <div className="p-6 bg-white border border-slate-200 rounded-lg text-xs text-slate-500 animate-pulse">
          Loading store shipments...
        </div>
      ) : filteredShipments.length === 0 ? (
        <div className="p-8 bg-white border border-slate-200 rounded-lg text-center space-y-2">
          <Truck className="w-8 h-8 text-slate-300 mx-auto" />
          <div className="text-xs font-medium text-slate-700">No shipments found</div>
          <div className="text-[11px] text-slate-500">
            Shipments created from order fulfillment will appear here.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredShipments.map((shp) => (
            <ShipmentTimelineCard
              key={shp.id}
              storeId={store_id}
              shipment={shp}
              onStatusUpdated={fetchStoreShipments}
            />
          ))}
        </div>
      )}
    </div>
  );
}
