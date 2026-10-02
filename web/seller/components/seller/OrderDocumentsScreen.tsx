'use client';

import React, { useEffect, useState } from 'react';
import { sellerClient } from '@/lib/api/client';
import type { SellerOrderDetail } from '@/lib/api/types';
import { CapabilityState } from './CapabilityState';
import { createUnavailableState } from '@/lib/screens/state';
import { Printer, FileText, Download } from 'lucide-react';

interface OrderDocumentsScreenProps {
  storeId: string;
  orderId: string;
}

export function OrderDocumentsScreen({ storeId, orderId }: OrderDocumentsScreenProps) {
  const [order, setOrder] = useState<SellerOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOrder();
  }, [storeId, orderId]);

  const loadOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await sellerClient.getStoreOrderDetail(storeId, orderId);
      setOrder(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load order details.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <CapabilityState
        state={{
          status: 'loading',
          title: 'Loading Order Documents',
          description: 'Preparing document markup for print...',
        }}
      />
    );
  }

  const zatcaExportState = createUnavailableState(
    'PDF Export & ZATCA E-Invoicing Signing',
    'Server-side PDF generation, shipping label PDF downloads, and ZATCA Phase 2 e-invoice XML/PDF signing are not supported by Core.'
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Order Documents #{order?.order_number || orderId}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Print packing slips and order receipts directly from your browser.
          </p>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500"
        >
          <Printer className="h-4 w-4" /> Print Document
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-rose-50 p-4 border border-rose-200 text-sm text-rose-700 print:hidden">
          {error}
        </div>
      )}

      {/* Printable Invoice / Packing Slip markup */}
      <div className="rounded-lg border bg-white p-8 shadow-sm dark:bg-slate-900 space-y-6 print:border-none print:shadow-none">
        <div className="flex justify-between border-b pb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">PACKING SLIP & RECEIPT</h2>
            <p className="text-xs text-slate-500">Store ID: {storeId}</p>
          </div>
          <div className="text-end">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Order: #{order?.order_number}</p>
            <p className="text-xs text-slate-500">Date: {order?.created_at ? new Date(order.created_at).toLocaleDateString() : ''}</p>
            <p className="text-xs font-semibold text-emerald-600">Status: {order?.status}</p>
          </div>
        </div>

        {order?.shipping_address && (
          <div className="text-xs space-y-1">
            <p className="font-semibold text-slate-900 dark:text-white">Shipping Recipient:</p>
            <p>{order.shipping_address.recipient_name}</p>
            <p>{order.shipping_address.address_line_1}</p>
            <p>{order.shipping_address.city}, {order.shipping_address.country_code}</p>
            <p>Phone: {order.shipping_address.phone}</p>
          </div>
        )}

        <table className="w-full text-start text-xs border-collapse">
          <thead>
            <tr className="border-b bg-slate-50 dark:bg-slate-800">
              <th className="p-2 text-start">Item</th>
              <th className="p-2 text-start">SKU</th>
              <th className="p-2 text-end">Qty</th>
              <th className="p-2 text-end">Unit Price</th>
              <th className="p-2 text-end">Total</th>
            </tr>
          </thead>
          <tbody>
            {order?.items?.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="p-2 font-medium">{item.product_name}</td>
                <td className="p-2 font-mono">{item.sku_code}</td>
                <td className="p-2 text-end">{item.quantity}</td>
                <td className="p-2 text-end">{order.currency} {(item.unit_price / 100).toFixed(2)}</td>
                <td className="p-2 text-end">{order.currency} {(item.total_price / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end pt-4">
          <div className="w-48 space-y-1 text-xs text-end">
            <div className="flex justify-between font-semibold border-t pt-2 text-slate-900 dark:text-white text-sm">
              <span>Total:</span>
              <span>{order?.currency} {((order?.total || 0) / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="print:hidden">
        <CapabilityState state={zatcaExportState} />
      </div>
    </div>
  );
}
