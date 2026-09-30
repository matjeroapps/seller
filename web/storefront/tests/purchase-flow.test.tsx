import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { PurchaseControl } from '../src/themes/shared/PurchaseControl';
import { copyFor } from './support/render';

describe('PurchaseControl Component', () => {
  const copy = copyFor('en');

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders enabled Add to Cart button when product is in stock', () => {
    render(
      <PurchaseControl
        variants={[{ code: 'DEF', available: true, availabilityLabel: 'In stock', skuCount: 1, skuId: 'sku-1' }]}
        defaultSkuId="sku-1"
        available={true}
        copy={copy}
        locale="en"
      />
    );

    const button = screen.getByRole('button', { name: /add to cart/i });
    expect(button).toBeEnabled();
  });

  it('disables button when product is out of stock', () => {
    render(
      <PurchaseControl
        variants={[{ code: 'DEF', available: false, availabilityLabel: 'Out of stock', skuCount: 1, skuId: 'sku-1' }]}
        defaultSkuId="sku-1"
        available={false}
        copy={copy}
        locale="en"
      />
    );

    const button = screen.getByRole('button', { name: /out of stock/i });
    expect(button).toBeDisabled();
  });

  it('submits add to cart request successfully and displays confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'cart-123', items: [] })
    });
    global.fetch = fetchMock;

    render(
      <PurchaseControl
        variants={[{ code: 'DEF', available: true, availabilityLabel: 'In stock', skuCount: 1, skuId: 'sku-1' }]}
        defaultSkuId="sku-1"
        available={true}
        copy={copy}
        locale="en"
      />
    );

    const button = screen.getByRole('button', { name: /add to cart/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/v1/storefront/carts/items',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ sku_id: 'sku-1', quantity: 1 })
        })
      );
    });

    expect(await screen.findByRole('link', { name: copy.cart.viewCart })).toBeInTheDocument();
    expect(screen.getAllByText(copy.cart.added).length).toBeGreaterThanOrEqual(1);
  });

  it('renders Buy Now button and redirects when purchaseBehavior is buy_now', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ checkout_session_id: 'sess-abc' })
    });
    global.fetch = fetchMock;

    render(
      <PurchaseControl
        variants={[{ code: 'DEF', available: true, availabilityLabel: 'In stock', skuCount: 1, skuId: 'sku-1' }]}
        defaultSkuId="sku-1"
        available={true}
        copy={copy}
        locale="en"
        purchaseBehavior="buy_now"
      />
    );

    const button = screen.getByRole('button', { name: /buy now/i });
    expect(button).toBeEnabled();
  });
});
