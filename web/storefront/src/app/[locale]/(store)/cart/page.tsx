'use client';

import { useEffect, useState, use } from 'react';
import { dictionaryFor, isLocale, type Locale } from '../../../../i18n/locales';

type CartItem = {
  id: string;
  sku_id: string;
  quantity: number;
  expected_unit_price_minor: number;
  expected_currency_code: string;
};

type Cart = {
  id: string;
  status: string;
  market_code: string;
  items: CartItem[];
};

export default function CartPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = use(params);
  const locale: Locale = isLocale(resolvedParams.locale) ? resolvedParams.locale : 'en';
  const copy = dictionaryFor(locale);

  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<boolean>(false);

  async function fetchCart() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/v1/storefront/carts', { credentials: 'same-origin' });
      if (res.status === 401 || res.status === 404) {
        setCart(null);
        return;
      }
      if (!res.ok) {
        throw new Error('Failed to load cart');
      }
      const data = await res.json();
      setCart(data);
    } catch (err: any) {
      setError(err.message || 'Error loading cart');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCart();
  }, []);

  async function handleUpdateQuantity(itemID: string, newQty: number) {
    if (newQty < 1) return;
    try {
      const res = await fetch(`/v1/storefront/carts/items/${itemID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ quantity: newQty })
      });
      if (res.ok) {
        const updated = await res.json();
        setCart(updated);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRemoveItem(itemID: string) {
    try {
      const res = await fetch(`/v1/storefront/carts/items/${itemID}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      if (res.ok) {
        const updated = await res.json();
        setCart(updated);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCheckout() {
    setCheckoutLoading(true);
    setError(null);
    try {
      const res = await fetch('/v1/storefront/checkout/sessions', {
        method: 'POST',
        credentials: 'same-origin'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'Failed to start checkout session');
      }
      const session = await res.json();
      window.location.href = `/${locale}/checkout/${session.id}`;
    } catch (err: any) {
      setError(err.message || 'Error starting checkout');
      setCheckoutLoading(false);
    }
  }

  const subtotal = (cart?.items || []).reduce(
    (sum, item) => sum + item.expected_unit_price_minor * item.quantity,
    0
  );
  const currency = cart?.items?.[0]?.expected_currency_code || 'USD';

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
          <h1>{copy.cart.title}</h1>
          <p>{copy.checkout.submitting}</p>
        </div>
      </main>
    );
  }

  const isEmpty = !cart || !cart.items || cart.items.length === 0;

  return (
    <main className="main-content">
      <div className="container">
        <h1>{copy.cart.title}</h1>

        {error ? <div className="error-banner">{error}</div> : null}

        {isEmpty ? (
          <div className="empty-cart">
            <p>{copy.cart.empty}</p>
            <a href={`/${locale}`} className="button button--primary">
              {copy.cart.continueShopping}
            </a>
          </div>
        ) : (
          <div className="cart-layout">
            <table className="cart-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>{copy.cart.unitPrice}</th>
                  <th>{copy.cart.quantity}</th>
                  <th>{copy.cart.lineTotal}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cart.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="cart-item__sku">{item.sku_id}</span>
                    </td>
                    <td>{formatMoney(item.expected_unit_price_minor, item.expected_currency_code)}</td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={item.quantity}
                        onChange={(e) =>
                          handleUpdateQuantity(item.id, parseInt(e.target.value, 10) || 1)
                        }
                        className="quantity-input"
                      />
                    </td>
                    <td>
                      {formatMoney(
                        item.expected_unit_price_minor * item.quantity,
                        item.expected_currency_code
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="button button--danger button--sm"
                      >
                        {copy.cart.remove}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="cart-summary">
              <div className="cart-summary__row">
                <span>{copy.cart.subtotal}:</span>
                <strong>{formatMoney(subtotal, currency)}</strong>
              </div>
              <div className="cart-summary__actions">
                <a href={`/${locale}`} className="button button--secondary">
                  {copy.cart.continueShopping}
                </a>
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={checkoutLoading}
                  className="button button--primary"
                >
                  {checkoutLoading ? copy.checkout.submitting : copy.cart.checkout}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
