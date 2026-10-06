'use client';

import { useEffect, useState, use, useMemo } from 'react';
import Link from 'next/link';
import { ChartNoAxesColumn, RefreshCw, AlertCircle, CheckCircle, ArrowDownUp, Calculator } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { InventorySnapshot, StoreLocation, Product, InventoryAdjustmentPayload } from '@/lib/api/types';

export default function StoreInventoryPage({
  params
}: {
  params: Promise<{ store_id: string }> | { store_id: string };
}) {
  const unwrappedParams =
    params && typeof (params as unknown as Promise<{ store_id: string }>).then === 'function'
      ? use(params as Promise<{ store_id: string }>)
      : (params as unknown as { store_id: string }) || {};
  const { store_id } = unwrappedParams;

  const [snapshots, setSnapshots] = useState<InventorySnapshot[]>([]);
  const [locations, setLocations] = useState<StoreLocation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [mode, setMode] = useState<'delta' | 'cycle_count'>('delta');
  const [selectedSkuId, setSelectedSkuId] = useState('');
  const [customSkuId, setCustomSkuId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [customLocationId, setCustomLocationId] = useState('');
  const [delta, setDelta] = useState<number>(10);
  const [targetQty, setTargetQty] = useState<number>(0);
  const [reasonCode, setReasonCode] = useState<string>('received_stock');
  const [note, setNote] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadInventory = () => {
    setLoading(true);
    setActionError(null);

    Promise.all([
      sellerApi.listStoreInventory(store_id).catch(() => ({ items: [] })),
      sellerApi.listStoreLocations ? sellerApi.listStoreLocations(store_id).catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
      sellerApi.listStoreProducts ? sellerApi.listStoreProducts(store_id).catch(() => ({ items: [] })) : Promise.resolve({ items: [] })
    ])
      .then(([invRes, locRes, prodRes]) => {
        setSnapshots(invRes?.items || []);
        if (locRes && Array.isArray(locRes.items)) {
          setLocations(locRes.items);
        }
        if (prodRes && Array.isArray(prodRes.items)) {
          setProducts(prodRes.items);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadInventory();
  }, [store_id]);

  // Handle mode toggle
  const handleModeChange = (newMode: 'delta' | 'cycle_count') => {
    setMode(newMode);
    if (newMode === 'cycle_count') {
      setReasonCode('cycle_count_reconciliation');
    } else {
      setReasonCode(delta >= 0 ? 'received_stock' : 'damaged');
    }
  };

  // Compile available SKUs from products and existing snapshots
  const availableSkus = useMemo(() => {
    const map = new Map<string, string>();
    for (const snap of snapshots) {
      if (snap.sku_id) {
        map.set(snap.sku_id, snap.sku_code ? `${snap.sku_code} (${snap.sku_id.slice(0, 8)})` : `SKU: ${snap.sku_id.slice(0, 8)}...`);
      }
    }
    for (const prod of products) {
      if (prod.id) {
        // Fallback product-level representation
        map.set(prod.id, `${prod.name || 'Product'} (${prod.id.slice(0, 8)})`);
      }
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [snapshots, products]);

  // Compile available locations from loaded locations and existing snapshots
  const availableLocations = useMemo(() => {
    const map = new Map<string, string>();
    for (const loc of locations) {
      map.set(loc.id, `${loc.name} (${loc.code}) - ${loc.location_type || 'warehouse'}`);
    }
    for (const snap of snapshots) {
      if (snap.fulfillment_location_id && !map.has(snap.fulfillment_location_id)) {
        map.set(snap.fulfillment_location_id, snap.location_name ? `${snap.location_name}` : `Location: ${snap.fulfillment_location_id.slice(0, 8)}...`);
      }
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [locations, snapshots]);

  const activeSkuId = selectedSkuId === '__custom__' ? customSkuId.trim() : selectedSkuId;
  const activeLocationId = locationId === '__custom__' ? customLocationId.trim() : locationId;

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSkuId || !activeLocationId) {
      setActionError('Please select or enter both a SKU and a Fulfillment Location.');
      return;
    }

    setAdjusting(true);
    setActionError(null);
    setActionSuccess(null);

    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined;

    const payload: InventoryAdjustmentPayload = {
      fulfillment_location_id: activeLocationId,
      sku_id: activeSkuId,
      reason_code: reasonCode,
      note: note.trim() || undefined,
      idempotency_key: idempotencyKey
    };

    if (mode === 'cycle_count') {
      payload.target_qty = targetQty;
    } else {
      payload.qty_delta = delta;
    }

    try {
      const res = await sellerApi.adjustInventory(store_id, payload);
      setActionSuccess(
        `Stock successfully updated! New on-hand: ${res.on_hand_qty ?? 'updated'}, available: ${res.available_qty ?? 'updated'} (delta: ${res.quantity_delta > 0 ? `+${res.quantity_delta}` : res.quantity_delta})`
      );
      loadInventory();
    } catch (err: any) {
      setActionError(err.message || 'Failed to adjust inventory');
    } finally {
      setAdjusting(false);
    }
  };

  const prefillAdjustment = (snap: InventorySnapshot) => {
    setLocationId(snap.fulfillment_location_id);
    setSelectedSkuId(snap.sku_id);
    if (mode === 'cycle_count') {
      setTargetQty(snap.on_hand_qty);
    }
  };

  return (
    <div className="space-y-6">
      {actionError && (
        <div data-testid="error-banner" className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-3 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div data-testid="success-banner" className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 text-xs text-emerald-700">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Store Inventory Snapshots</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage on-hand inventory snapshots and reconcile physical stock across fulfillment locations
          </p>
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Adjust Inventory Stock</h2>
            <p className="text-[11px] text-slate-500">Record stock movement or reconcile physical cycle counts</p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
            <button
              type="button"
              data-testid="mode-delta-btn"
              onClick={() => handleModeChange('delta')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                mode === 'delta'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownUp className="w-3.5 h-3.5" /> Relative Delta (+/-)
            </button>
            <button
              type="button"
              data-testid="mode-cycle-count-btn"
              onClick={() => handleModeChange('cycle_count')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                mode === 'cycle_count'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" /> Cycle Count Target
            </button>
          </div>
        </div>

        <form onSubmit={handleAdjust} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* SKU Selector */}
            <div>
              <label htmlFor="sku-select" className="block text-slate-700 font-medium mb-1">
                Select SKU *
              </label>
              <select
                id="sku-select"
                data-testid="sku-select"
                value={selectedSkuId}
                onChange={(e) => setSelectedSkuId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">-- Choose SKU --</option>
                {availableSkus.map((sku) => (
                  <option key={sku.id} value={sku.id}>
                    {sku.label}
                  </option>
                ))}
                <option value="__custom__">+ Enter Custom SKU ID...</option>
              </select>

              {selectedSkuId === '__custom__' && (
                <input
                  type="text"
                  required
                  placeholder="Paste SKU UUID..."
                  value={customSkuId}
                  onChange={(e) => setCustomSkuId(e.target.value)}
                  className="mt-1.5 w-full px-2.5 py-1 border border-slate-300 rounded font-mono text-[11px] focus:outline-none"
                />
              )}
            </div>

            {/* Location Selector */}
            <div>
              <label htmlFor="location-select" className="block text-slate-700 font-medium mb-1">
                Fulfillment Location *
              </label>
              <select
                id="location-select"
                data-testid="location-select"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">-- Choose Location --</option>
                {availableLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.label}
                  </option>
                ))}
                <option value="__custom__">+ Enter Custom Location ID...</option>
              </select>

              {locationId === '__custom__' && (
                <input
                  type="text"
                  required
                  placeholder="Paste Location UUID..."
                  value={customLocationId}
                  onChange={(e) => setCustomLocationId(e.target.value)}
                  className="mt-1.5 w-full px-2.5 py-1 border border-slate-300 rounded font-mono text-[11px] focus:outline-none"
                />
              )}
            </div>

            {/* Quantity Input (Dual Mode) */}
            {mode === 'delta' ? (
              <div>
                <label htmlFor="qty-delta-input" className="block text-slate-700 font-medium mb-1">
                  Quantity Delta (+/-) *
                </label>
                <input
                  id="qty-delta-input"
                  data-testid="qty-delta-input"
                  type="number"
                  required
                  step="1"
                  value={delta}
                  onChange={(e) => setDelta(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">e.g. +10 for received, -3 for damaged</p>
              </div>
            ) : (
              <div>
                <label htmlFor="target-qty-input" className="block text-slate-700 font-medium mb-1">
                  Target Physical Count *
                </label>
                <input
                  id="target-qty-input"
                  data-testid="target-qty-input"
                  type="number"
                  required
                  min="0"
                  step="1"
                  value={targetQty}
                  onChange={(e) => setTargetQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Server reconciles delta to match physical count</p>
              </div>
            )}

            {/* Reason Code */}
            <div>
              <label htmlFor="reason-code-select" className="block text-slate-700 font-medium mb-1">
                Reason Code *
              </label>
              <select
                id="reason-code-select"
                data-testid="reason-code-select"
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="received_stock">Stock Received (استلام مخزون)</option>
                <option value="damaged">Damaged Goods (تلف)</option>
                <option value="cycle_count_reconciliation">Cycle Count Reconciliation (جرد فعلي)</option>
                <option value="theft_loss">Theft / Shrinkage Loss (فقد / سرقة)</option>
                <option value="customer_return_manual">Customer Return (مرتجع عميل)</option>
                <option value="correction">Audit Correction (تصحيح مخزون)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div className="sm:col-span-3">
              <label htmlFor="note-input" className="block text-slate-700 font-medium mb-1">
                Audit Note (Optional)
              </label>
              <input
                id="note-input"
                data-testid="note-input"
                type="text"
                placeholder="Reference purchase order, count sheet, or incident..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={adjusting || !activeSkuId || !activeLocationId}
                className="w-full px-4 py-2 font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {adjusting ? 'Adjusting...' : mode === 'cycle_count' ? 'Reconcile Count' : 'Apply Adjustment'}
              </button>
            </div>
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
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">On Hand Qty</th>
                  <th className="px-4 py-3">Reserved Qty</th>
                  <th className="px-4 py-3">Available Qty</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {snapshots.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{s.location_name || 'Location'}</div>
                      <div className="font-mono text-[10px] text-slate-400">{s.fulfillment_location_id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{s.sku_code || 'SKU'}</div>
                      <div className="font-mono text-[10px] text-slate-400">{s.sku_id}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{s.on_hand_qty}</td>
                    <td className="px-4 py-3 text-slate-500">{s.reserved_qty}</td>
                    <td className="px-4 py-3 font-bold text-emerald-700">{s.available_qty}</td>
                    <td className="px-4 py-3 text-slate-400">v{s.version}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => prefillAdjustment(s)}
                        className="text-indigo-600 hover:text-indigo-800 font-medium text-[11px]"
                      >
                        Select for Adjust
                      </button>
                    </td>
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
