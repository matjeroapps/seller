'use client';

import { useEffect, useState, use } from 'react';
import { dictionaryFor, isLocale, type Locale } from '../../../../../i18n/locales';

type OrderItem = {
  id: string;
  sku_id?: string;
  product_title_snapshot: string;
  sku_code_snapshot: string;
  unit_price_minor: number;
  currency_code: string;
  quantity: number;
  line_total_minor: number;
};

type Order = {
  id: string;
  order_number: string;
  market_code: string;
  status: string;
  currency_code: string;
  subtotal_minor: number;
  total_minor: number;
  confirmation_deadline_at: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
};

export default function OrderDetailPage({
  params
}: {
  params: Promise<{ locale: string; orderID: string }>;
}) {
  const resolvedParams = use(params);
  const locale: Locale = isLocale(resolvedParams.locale) ? resolvedParams.locale : 'en';
  const orderID = resolvedParams.orderID;
  const copy = dictionaryFor(locale);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<boolean>(false);

  async function fetchOrder() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/v1/storefront/orders/${orderID}`, { credentials: 'same-origin' });
      if (!res.ok) {
        if (res.status === 401 || res.status === 404) {
          throw new Error('Order not found or unauthorized access');
        }
        throw new Error('Failed to load order');
      }
      const data = await res.json();
      setOrder(data);
    } catch (err: any) {
      setError(err.message || 'Error loading order');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrder();
  }, [orderID]);

  async function handleCancelOrder() {
    if (!order || order.status !== 'pending') return;
    setCancelling(true);
    try {
      const res = await fetch(`/v1/storefront/orders/${orderID}/cancel`, {
        method: 'POST',
        credentials: 'same-origin'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error?.message || 'Failed to cancel order');
      }
      const updated = await res.json();
      setOrder(updated);
    } catch (err: any) {
      setError(err.message || 'Error cancelling order');
    } finally {
      setCancelling(false);
    }
  }

  function formatMoney(amountMinor: number, curr: string) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 2
    }).format(amountMinor / 100);
  }

  if (loading) {
    return (
      <main className="main-content">
        <div className="container">
          <h1>{copy.order.title}</h1>
          <p>{copy.checkout.submitting}</p>
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="main-content">
        <div className="container">
          <h1>{copy.order.title}</h1>
          <div className="error-banner">{error || 'Order not found'}</div>
          <a href={`/${locale}`} className="button button--secondary">
            {copy.navigation.home}
          </a>
        </div>
      </main>
    );
  }

  const isPending = order.status === 'pending';

  return (
    <main className="main-content">
      <div className="container">
        <header className="order-header">
          <h1>{copy.order.number.replace('{number}', order.order_number)}</h1>
          <div className={`order-status order-status--${order.status}`}>
            <span>{copy.order.status}: </span>
            <strong>
              {order.status === 'pending'
                ? copy.order.statusPending
                : order.status === 'cancelled'
                ? copy.order.statusCancelled
                : order.status === 'confirmed'
                ? copy.order.statusConfirmed
                : order.status}
            </strong>
          </div>
        </header>

        <div className="order-meta">
          <p>
            <strong>{copy.order.created}:</strong> {new Date(order.created_at).toLocaleString(locale)}
          </p>
          {order.confirmation_deadline_at ? (
            <p>
              <strong>{copy.order.confirmationDeadline}:</strong>{' '}
              {new Date(order.confirmation_deadline_at).toLocaleString(locale)}
            </p>
          ) : null}
        </div>

        <section className="order-items-section">
          <h2>{copy.order.items}</h2>
          <table className="cart-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>{copy.cart.unitPrice}</th>
                <th>{copy.cart.quantity}</th>
                <th>{copy.cart.lineTotal}</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div>
                      <strong>{item.product_title_snapshot || item.sku_code_snapshot}</strong>
                    </div>
                    {item.sku_code_snapshot ? (
                      <small className="text-muted">SKU: {item.sku_code_snapshot}</small>
                    ) : null}
                  </td>
                  <td>{formatMoney(item.unit_price_minor, item.currency_code)}</td>
                  <td>{item.quantity}</td>
                  <td>{formatMoney(item.line_total_minor, item.currency_code)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="order-totals-section">
          <div className="cart-summary__row">
            <span>{copy.cart.subtotal}:</span>
            <strong>{formatMoney(order.subtotal_minor, order.currency_code)}</strong>
          </div>
          <div className="cart-summary__row cart-summary__row--total">
            <span>{copy.cart.lineTotal}:</span>
            <strong>{formatMoney(order.total_minor, order.currency_code)}</strong>
          </div>
        </section>

        {isPending ? (
          <div className="order-actions">
            <button
              type="button"
              onClick={handleCancelOrder}
              disabled={cancelling}
              className="button button--danger"
            >
              {cancelling ? copy.order.cancelling : copy.order.cancelOrder}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
