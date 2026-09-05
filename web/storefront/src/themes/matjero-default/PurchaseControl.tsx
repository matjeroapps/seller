'use client';

import { useState } from 'react';
import type { ProductVariantModel } from '../contract';
import type { Dictionary } from '../../i18n/locales';

export function PurchaseControl({
  variants,
  defaultSkuId,
  available,
  copy,
  locale
}: {
  variants: ProductVariantModel[];
  defaultSkuId?: string;
  available: boolean;
  copy: Dictionary;
  locale: string;
}) {
  const [selectedCode, setSelectedCode] = useState<string>(
    variants.find((v) => v.available)?.code || variants[0]?.code || ''
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<boolean>(false);

  const selectedVariant = variants.find((v) => v.code === selectedCode) || variants[0];
  const targetSkuId = selectedVariant?.skuId || defaultSkuId;
  const isPurchasable = available && (variants.length === 0 || (selectedVariant && selectedVariant.available)) && Boolean(targetSkuId);

  async function handleAddToCart(e: React.FormEvent) {
    e.preventDefault();
    if (!targetSkuId || !isPurchasable) return;

    setLoading(true);
    setError(null);
    setAdded(false);

    try {
      let res = await fetch('/v1/storefront/carts/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ sku_id: targetSkuId, quantity })
      });

      if (res.status === 401 || res.status === 404) {
        const cartRes = await fetch('/v1/storefront/carts', { method: 'POST', credentials: 'same-origin' });
        if (!cartRes.ok) {
          throw new Error('Failed to create cart');
        }
        res = await fetch('/v1/storefront/carts/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ sku_id: targetSkuId, quantity })
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'Failed to add item to cart');
      }

      setAdded(true);
    } catch (err: any) {
      setError(err.message || 'Failed to add item to cart');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="purchase-control" onSubmit={handleAddToCart}>
      {variants.length > 0 ? (
        <section className="product__section">
          <h2 className="product__heading">{copy.product.variants}</h2>
          <div className="variants-list">
            {variants.map((v) => (
              <label
                key={v.code}
                className={`variant-option ${selectedCode === v.code ? 'variant-option--selected' : ''} ${
                  !v.available ? 'variant-option--disabled' : ''
                }`}
              >
                <input
                  type="radio"
                  name="variant"
                  value={v.code}
                  checked={selectedCode === v.code}
                  onChange={() => setSelectedCode(v.code)}
                />
                <span className="variant-option__code">{v.code}</span>
                <span className="variant-option__stock">({v.availabilityLabel})</span>
              </label>
            ))}
          </div>
        </section>
      ) : null}

      <div className="purchase-control__actions">
        <div className="quantity-selector">
          <label htmlFor="product-qty" className="visually-hidden">
            {copy.cart.quantity}
          </label>
          <input
            id="product-qty"
            type="number"
            min="1"
            max="99"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="quantity-input"
          />
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!isPurchasable || loading}
          className="button button--primary add-to-cart-btn"
        >
          {loading
            ? copy.checkout.submitting
            : added
            ? copy.cart.added
            : !isPurchasable
            ? copy.availability.out_of_stock
            : copy.cart.addToCart}
        </button>
      </div>

      {added ? (
        <div className="purchase-control__success">
          <span>{copy.cart.added}</span>
          <a href={`/${locale}/cart`} className="button button--secondary button--sm">
            {copy.cart.viewCart}
          </a>
        </div>
      ) : null}

      {error ? <div className="purchase-control__error">{error}</div> : null}
    </form>
  );
}
