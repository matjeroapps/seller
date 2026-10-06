'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import {
  PackageCheck,
  RefreshCw,
  Truck,
  Plus,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Package,
} from 'lucide-react';

import { sellerApi } from '@/lib/api/client';
import type { Shipment, CreateStoreShipmentPayload } from '@/lib/api/types';
import { CreateShipmentModal } from './CreateShipmentModal';

type ShipmentsOverviewScreenProps = {
  storeId: string;
};

const shipmentStatuses = [
  'ALL',
  'PENDING',
  'PROCESSING',
  'READY_FOR_PICKUP',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'RETURNED',
];

function getStatusBadgeStyle(status: string) {
  switch (status.toUpperCase()) {
    case 'DELIVERED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'SHIPPED':
    case 'OUT_FOR_DELIVERY':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'PROCESSING':
    case 'READY_FOR_PICKUP':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'PENDING':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'FAILED':
    case 'RETURNED':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

function formatCost(minor: number, currency: string) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: currency || 'SAR',
  }).format(minor / 100);
}

export function ShipmentsOverviewScreen({ storeId }: ShipmentsOverviewScreenProps) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState('ALL');
  const [totalCount, setTotalCount] = useState(0);

  // Modal and action states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadShipments = useCallback(async (statusFilter: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await sellerApi.listStoreShipments(storeId, {
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        page: 1,
        limit: 50,
      });
      setShipments(response.items || []);
      setTotalCount(response.total_count ?? (response.items?.length || 0));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load store shipments.';
      setError(
        message === 'Actor authentication required'
          ? 'Your session could not be used to load shipment operations. Refresh the dashboard or sign in again.'
          : message
      );
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadShipments(activeStatus);
  }, [loadShipments, activeStatus]);

  const handleCreateShipment = async (payload: CreateStoreShipmentPayload) => {
    setModalLoading(true);
    try {
      const created = await sellerApi.createStoreShipment(storeId, payload);
      setIsModalOpen(false);
      setNotification({
        type: 'success',
        message: `Shipment created successfully with tracking code ${created.tracking_number || created.id}.`,
      });
      loadShipments(activeStatus);
    } catch (err: unknown) {
      throw err;
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-indigo-600">
            <Truck className="w-4 h-4" />
            <span>Store Fulfillment Queue</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">Store Shipments Queue</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-full border border-slate-200">
              {totalCount} shipments
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Monitor and dispatch package shipments across all store orders
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadShipments(activeStatus)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Shipment
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={`flex items-start justify-between p-3.5 text-xs rounded-xl border ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
          role="status"
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-xs opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl" role="alert">
          {error}
        </div>
      )}

      {/* Shipments Panel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap bg-slate-50/50">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full" aria-label="Shipment status filters">
            {shipmentStatuses.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setActiveStatus(status)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  activeStatus === status
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                {status.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Showing {shipments.length} of {totalCount} shipments
          </div>
        </div>

        {/* Content Table / Empty States */}
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
            <span>Loading store shipments...</span>
          </div>
        ) : shipments.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="inline-flex p-3 bg-slate-100 text-slate-400 rounded-full">
              <Truck className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">No shipments found in this status</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              There are no shipments matching your filter. Create a shipment to begin order fulfillment.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
              >
                Create Shipment
              </button>
              <Link
                href={`/dashboard/stores/${storeId}/orders`}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                View Store Orders
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Tracking Code</th>
                  <th className="py-3 px-4">Carrier</th>
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Shipping Cost</th>
                  <th className="py-3 px-4">Created At</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shipments.map((sh) => (
                  <tr key={sh.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-900">
                      <span className="flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-slate-400" />
                        {sh.tracking_number || sh.id}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {sh.carrier_name || <span className="text-slate-400 italic">Merchant / Internal</span>}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      <Link
                        href={`/dashboard/stores/${storeId}/orders/${sh.order_id}`}
                        className="hover:text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        {sh.order_id}
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </Link>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadgeStyle(
                          sh.status
                        )}`}
                      >
                        {sh.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {sh.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || sh.items?.length || 1} units
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {formatCost(sh.shipping_cost_minor, sh.currency)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {sh.created_at ? new Date(sh.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/dashboard/stores/${storeId}/orders/${sh.order_id}`}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        View Order
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Shipment Modal */}
      <CreateShipmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateShipment}
        loading={modalLoading}
      />
    </div>
  );
}
