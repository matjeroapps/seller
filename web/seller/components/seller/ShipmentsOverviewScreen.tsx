'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PackageCheck, RefreshCw, Truck } from 'lucide-react';

import { sellerClient } from '@/lib/api/client';
import type { SellerOrder } from '@/lib/api/types';

type ShipmentsOverviewScreenProps = {
  storeId: string;
};

const shipmentStatuses = ['ALL', 'PENDING', 'PROCESSING', 'READY_FOR_PICKUP', 'SHIPPED', 'DELIVERED', 'FAILED', 'RETURNED'];

function formatMoney(order: SellerOrder) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: order.currency || 'SAR',
  }).format((order.total || 0) / 100);
}

export function ShipmentsOverviewScreen({ storeId }: ShipmentsOverviewScreenProps) {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState('ALL');

  async function loadOrders() {
    setLoading(true);
    setError(null);
    try {
      const response = await sellerClient.listStoreOrders(storeId, { limit: 25 });
      setOrders(response.orders || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load shipment-ready orders.';
      setError(
        message === 'Actor authentication required'
          ? 'Your session could not be used to load shipment operations. Refresh the dashboard or sign in again.'
          : message
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const response = await sellerClient.listStoreOrders(storeId, { limit: 25 });
        if (cancelled) return;
        setOrders(response.orders || []);
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load shipment-ready orders.';
        setError(
          message === 'Actor authentication required'
            ? 'Your session could not be used to load shipment operations. Refresh the dashboard or sign in again.'
            : message
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const filteredOrders = useMemo(() => {
    if (activeStatus === 'ALL') return orders;
    return orders.filter((order) => order.status.toUpperCase() === activeStatus);
  }, [activeStatus, orders]);

  return (
    <div className="seller-dashboard">
      <section className="seller-dashboard-hero">
        <div>
          <div className="seller-dashboard-hero__eyebrow">
            <Truck aria-hidden="true" />
            <span>Shipping operations</span>
          </div>
          <div className="seller-dashboard-hero__title-row">
            <h1>Store Shipments Overview</h1>
            <span className="seller-status-badge seller-status-badge--neutral">{orders.length} orders</span>
          </div>
          <div className="seller-dashboard-hero__meta">
            <span>Store {storeId}</span>
            <span>Shipment actions are managed from order detail pages</span>
          </div>
        </div>
        <div className="seller-dashboard-hero__actions">
          <button type="button" onClick={loadOrders} disabled={loading}>
            <RefreshCw aria-hidden="true" />
            Refresh shipments
          </button>
        </div>
      </section>

      {error && (
        <div className="seller-alert seller-alert--danger" role="alert">
          <span>{error}</span>
        </div>
      )}

      <section className="seller-panel">
        <div className="seller-panel__header">
          <div>
            <span className="seller-section-kicker">Shipment queue</span>
            <h2>Fulfillment status filters</h2>
          </div>
          <PackageCheck aria-hidden="true" />
        </div>

        <div className="seller-filter-bar" aria-label="Shipment status filters">
          {shipmentStatuses.map((status) => (
            <button
              key={status}
              type="button"
              className={activeStatus === status ? 'is-active' : ''}
              onClick={() => setActiveStatus(status)}
            >
              {status}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="seller-inline-empty">Loading shipment operations...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="seller-empty-state">
            <Truck aria-hidden="true" />
            <h1>No shipment-ready orders found</h1>
            <p>Shipments are created from order detail pages after an order is ready for fulfillment.</p>
            <Link className="seller-primary-action" href={`/dashboard/stores/${storeId}/orders`}>
              View orders
            </Link>
          </div>
        ) : (
          <div className="seller-orders-table">
            {filteredOrders.map((order) => (
              <Link key={order.id} className="seller-orders-row" href={`/dashboard/stores/${storeId}/orders/${order.id}`}>
                <span>
                  <strong>{order.order_number}</strong>
                  <small>{order.recipient_name || 'Customer'}</small>
                </span>
                <span>{order.status}</span>
                <span>{order.item_count} items</span>
                <span>{formatMoney(order)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
