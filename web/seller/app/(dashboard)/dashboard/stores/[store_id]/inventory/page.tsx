'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ChartNoAxesColumn, RefreshCw, Plus, Minus } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { InventorySnapshot } from '@/lib/api/types';

export default function StoreInventoryPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = use(params);

  const [snapshots, setSnapshots] = useState<InventorySnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSkuId, setSelectedSkuId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [delta, setDelta] = useState<number>(10);
  const [adjusting, setAdjusting] = useState(false);

  const loadInventory = () => {
    setLoading(true);
    sellerApi
      .listStoreInventory(store_id)
      .then((res) => {
        setSnapshots(res.items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadInventory();
  }, [store_id]);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSkuId || !locationId) return;
    setAdjusting(true);
    try {
      await sellerApi.adjustInventory(store_id, {
        fulfillment_location_id: locationId,
        sku_id: selectedSkuId,
        qty_delta: delta
      });
      loadInventory();
    } catch (err: any) {
      alert(err.message || 'Failed to adjust inventory');
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Store Inventory Snapshots</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage on-hand inventory snapshots for seller-owned location SKUs</p>
        </div>
        <button
          type="button"
          onClick={loadInventory}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 self-start"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Inventory
        </button>
      </div>

      {/* Adjust Inventory Form */}
      <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">Adjust Inventory Stock</h2>
        <form onSubmit={handleAdjust} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-slate-500 font-medium mb-1">SKU ID *</label>
            <input
              type="text"
              required
              placeholder="sku_..."
              value={selectedSkuId}
              onChange={(e) => setSelectedSkuId(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-500 font-medium mb-1">Fulfillment Location ID *</label>
            <input
              type="text"
              required
              placeholder="loc_..."
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-500 font-medium mb-1">Quantity Delta (+/-) *</label>
            <input
              type="number"
              required
              value={delta}
              onChange={(e) => setDelta(parseInt(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:outline-none"
            />
          </div>

          <div className="self-end">
            <button
              type="submit"
              disabled={adjusting}
              className="w-full px-3 py-1.5 font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {adjusting ? 'Adjusting...' : 'Submit Adjustment'}
            </button>
          </div>
        </form>
      </div>

      {/* Inventory Snapshots Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-slate-500 animate-pulse">Loading inventory snapshots...</div>
        ) : snapshots.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <ChartNoAxesColumn className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            No store inventory snapshots found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 font-semibold">
                <tr>
                  <th className="px-4 py-3">Location ID</th>
                  <th className="px-4 py-3">SKU ID</th>
                  <th className="px-4 py-3">On Hand Qty</th>
                  <th className="px-4 py-3">Reserved Qty</th>
                  <th className="px-4 py-3">Available Qty</th>
                  <th className="px-4 py-3">Version</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {snapshots.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-600">{s.fulfillment_location_id}</td>
                    <td className="px-4 py-3 font-mono font-medium text-slate-900">{s.sku_id}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{s.on_hand_qty}</td>
                    <td className="px-4 py-3 text-slate-500">{s.reserved_qty}</td>
                    <td className="px-4 py-3 font-bold text-emerald-700">{s.available_qty}</td>
                    <td className="px-4 py-3 text-slate-400">v{s.version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
