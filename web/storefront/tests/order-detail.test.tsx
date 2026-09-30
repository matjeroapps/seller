import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

import OrderDetailPage from '../src/app/[locale]/(store)/orders/[orderID]/page';
import { copyFor } from './support/render';

describe('OrderDetailPage Component', () => {
  const copy = copyFor('en');

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockOrder = {
    id: 'ord-1234-5678',
    order_number: 'ORD-2026-999',
    market_code: 'SA',
    status: 'pending',
    currency_code: 'SAR',
    subtotal_minor: 14900,
    total_minor: 14900,
    confirmation_deadline_at: '2026-10-02T12:00:00Z',
    created_at: '2026-09-30T09:00:00Z',
    updated_at: '2026-09-30T09:00:00Z',
    items: [
      {
        id: 'item-1',
        sku_id: 'sku-1',
        product_title_snapshot: 'Classic Linen Shirt',
        sku_code_snapshot: 'SHIRT-LINEN-L',
        unit_price_minor: 14900,
        currency_code: 'SAR',
        quantity: 1,
        line_total_minor: 14900
      }
    ],
    address: {
      recipient_name: 'Ahmad Mansoor',
      address_line_1: 'King Fahd Road',
      city: 'Riyadh',
      country_code: 'SA'
    }
  };

  it('fetches and renders order details with line items and payment status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockOrder
    });
    global.fetch = fetchMock;

    render(
      <OrderDetailPage
        params={{ locale: 'en', orderID: 'ord-1234-5678' }}
      />
    );

    expect(await screen.findByText('Order #ORD-2026-999')).toBeInTheDocument();
    expect(screen.getByText('Classic Linen Shirt')).toBeInTheDocument();
    expect(screen.getByText('Ahmad Mansoor')).toBeInTheDocument();
    expect(screen.getByText('King Fahd Road')).toBeInTheDocument();
    expect(screen.getByText(copy.order.statusPending)).toBeInTheDocument();
    expect(screen.getByText(copy.order.paymentStatus)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.order.cancelOrder })).toBeInTheDocument();
  });

  it('handles customer self-service order cancellation', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockOrder
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ...mockOrder, status: 'cancelled' })
      });
    global.fetch = fetchMock;

    render(
      <OrderDetailPage
        params={{ locale: 'en', orderID: 'ord-1234-5678' }}
      />
    );

    const cancelBtn = await screen.findByRole('button', { name: copy.order.cancelOrder });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/v1/storefront/orders/ord-1234-5678/cancel',
        expect.objectContaining({ method: 'POST' })
      );
    });

    expect(await screen.findByText(copy.order.statusCancelled)).toBeInTheDocument();
  });

  it('renders error state when order is unauthorized or missing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({})
    });
    global.fetch = fetchMock;

    render(
      <OrderDetailPage
        params={{ locale: 'en', orderID: 'invalid-ord' }}
      />
    );

    expect(await screen.findByText('Order not found or unauthorized access')).toBeInTheDocument();
  });
});
