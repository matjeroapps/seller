import React from 'react';
import type { ApiClient } from '../lib/api';

type OrderItem = {
  id: string;
  sku_id: string;
  sku_code: string;
  product_name: string;
  quantity: number;
  unit_price: { amount: number; currency: string };
  total_price: { amount: number; currency: string };
};

type OrderTimelineEvent = {
  id: string;
  type: string;
  detail: string;
  created_at: string;
};

type OrderListItem = {
  id: string;
  order_number: string;
  status: string;
  currency: string;
  total: number;
  item_count: number;
  recipient_name: string;
  confirmation_deadline_at?: string;
  created_at: string;
};

type OrderDetail = {
  id: string;
  order_number: string;
  status: string;
  currency: string;
  total: number;
  confirmation_deadline_at?: string;
  shipping_address: Record<string, any>;
  contact_email: string;
  items: OrderItem[];
  timeline: OrderTimelineEvent[];
  allowed_next_actions: string[];
  created_at: string;
};

type OrdersPanelProps = {
  api: ApiClient;
  storeId: string;
  locale: string;
  copy: Record<string, string>;
};

export function OrdersPanel({ api, storeId, locale, copy }: OrdersPanelProps) {
  const [orders, setOrders] = React.useState<OrderListItem[]>([]);
  const [selectedOrder, setSelectedOrder] = React.useState<OrderDetail | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadOrders = React.useCallback(async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      setError(null);
      let url = `/v1/seller/stores/${encodeURIComponent(storeId)}/orders?locale=${locale}`;
      if (statusFilter) {
        url += `&status=${encodeURIComponent(statusFilter)}`;
      }
      const res = await api.get(url);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      } else {
        setError('Failed to load orders');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading orders');
    } finally {
      setLoading(false);
    }
  }, [api, storeId, statusFilter, locale]);

  React.useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const handleSelectOrder = async (orderId: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/v1/seller/stores/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(orderId)}?locale=${locale}`);
      if (res.ok) {
        setSelectedOrder(await res.json());
      } else {
        setError('Failed to load order detail');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading order detail');
    } finally {
      setLoading(false);
    }
  };

  const handleTransition = async (targetStatus: string) => {
    if (!selectedOrder) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.post(`/v1/seller/stores/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(selectedOrder.id)}/transition`, {
        target_status: targetStatus
      });
      if (res.ok) {
        const updatedDetail: OrderDetail = await res.json();
        setSelectedOrder(updatedDetail);
        await loadOrders();
      } else {
        const data = await res.json();
        setError(data.message || `Failed to transition to ${targetStatus}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transition error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="orders-panel">
      <div className="panel-header">
        <h2>{copy.ordersTitle || 'Seller Orders Management'}</h2>
        {selectedOrder && (
          <button type="button" className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>
            ← {copy.backToOrders || 'Back to Orders List'}
          </button>
        )}
      </div>

      {error && <div className="notice notice-error">{error}</div>}

      {!selectedOrder ? (
        <div className="orders-list-view">
          <div className="filter-bar">
            <label htmlFor="order-status-filter">Filter by status:</label>
            <select id="order-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="form-control form-control-sm">
              <option value="">All Orders</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="processing">Processing</option>
              <option value="ready_for_shipping">Ready for Shipping</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {loading ? (
            <div className="notice">{copy.loading || 'Loading orders...'}</div>
          ) : orders.length === 0 ? (
            <div className="notice">{copy.noOrders || 'No orders found.'}</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>#{o.order_number}</strong>
                    </td>
                    <td>{o.recipient_name}</td>
                    <td>{new Date(o.created_at).toLocaleString()}</td>
                    <td>{o.item_count}</td>
                    <td>{(o.total / 100).toFixed(2)} {o.currency}</td>
                    <td>
                      <span className={`status-badge status-${o.status}`}>{o.status}</span>
                    </td>
                    <td>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => void handleSelectOrder(o.id)}>
                        View & Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="order-detail-view">
          <div className="detail-card">
            <div className="detail-header">
              <h3>Order #{selectedOrder.order_number}</h3>
              <span className={`status-badge status-${selectedOrder.status}`}>{selectedOrder.status}</span>
            </div>

            <div className="order-actions-bar">
              {selectedOrder.status === 'pending' && (
                <>
                  <button type="button" className="btn btn-success" onClick={() => void handleTransition('confirmed')} disabled={loading}>
                    ✓ Confirm Order
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => void handleTransition('cancelled')} disabled={loading}>
                    Cancel Order
                  </button>
                </>
              )}
              {selectedOrder.status === 'confirmed' && (
                <>
                  <button type="button" className="btn btn-primary" onClick={() => void handleTransition('processing')} disabled={loading}>
                    ▶ Start Processing
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => void handleTransition('cancelled')} disabled={loading}>
                    Cancel Order
                  </button>
                </>
              )}
              {selectedOrder.status === 'processing' && (
                <>
                  <button type="button" className="btn btn-success" onClick={() => void handleTransition('ready_for_shipping')} disabled={loading}>
                    📦 Mark Ready for Shipping
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => void handleTransition('cancelled')} disabled={loading}>
                    Cancel Order
                  </button>
                </>
              )}
              {selectedOrder.status === 'ready_for_shipping' && (
                <div className="notice notice-info">
                  Ready for shipping (shipping integration is deferred in P5.8).
                </div>
              )}
            </div>

            <div className="grid-2">
              <div className="card-section">
                <h4>Customer Info</h4>
                <p><strong>Name:</strong> {selectedOrder.shipping_address?.recipient_name || 'N/A'}</p>
                <p><strong>Email:</strong> {selectedOrder.contact_email || 'N/A'}</p>
                <p><strong>Address:</strong> {selectedOrder.shipping_address?.address_line_1}, {selectedOrder.shipping_address?.city}, {selectedOrder.shipping_address?.country_code}</p>
              </div>

              <div className="card-section">
                <h4>Order Summary</h4>
                <p><strong>Total Amount:</strong> {(selectedOrder.total / 100).toFixed(2)} {selectedOrder.currency}</p>
                <p><strong>Created:</strong> {new Date(selectedOrder.created_at).toLocaleString()}</p>
                {selectedOrder.confirmation_deadline_at && (
                  <p><strong>Confirmation Deadline:</strong> {new Date(selectedOrder.confirmation_deadline_at).toLocaleString()}</p>
                )}
              </div>
            </div>

            <div className="card-section">
              <h4>Line Items</h4>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Unit Price</th>
                    <th>Quantity</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items?.map((item) => (
                    <tr key={item.id}>
                      <td>{item.product_name}</td>
                      <td>{item.sku_code}</td>
                      <td>{(item.unit_price.amount / 100).toFixed(2)} {item.unit_price.currency}</td>
                      <td>{item.quantity}</td>
                      <td>{(item.total_price.amount / 100).toFixed(2)} {item.total_price.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card-section">
              <h4>Timeline</h4>
              <ul className="timeline-list">
                {selectedOrder.timeline?.map((ev) => (
                  <li key={ev.id}>
                    <span className="event-time">{new Date(ev.created_at).toLocaleTimeString()}:</span> {ev.type} - {ev.detail}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
