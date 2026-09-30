import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import StoreOrderDetailPage from '../app/(dashboard)/dashboard/stores/[store_id]/orders/[order_id]/page';
import { sellerApi } from '../lib/api/client';
import type { SellerOrderDetail } from '../lib/api/types';

vi.mock('../lib/api/client', () => ({
  sellerApi: {
    listStoreOrders: vi.fn(),
    getStoreOrderDetail: vi.fn(),
    transitionStoreOrder: vi.fn()
  }
}));

describe('Manual Shipment Fulfillment & Tracking (T018 / US3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockReadyOrder: SellerOrderDetail = {
    id: 'ord_ready_1',
    order_number: 'ORD-2026-0002',
    status: 'ready_for_shipping',
    currency: 'SAR',
    subtotal: 25000,
    total: 27000,
    item_count: 1,
    contact_email: 'buyer@example.com',
    shipping_address: {
      recipient_name: 'Sara Al-Ghamdi',
      phone: '+966550000002',
      address_line_1: 'Olaya Street',
      city: 'Riyadh',
      country_code: 'SA'
    },
    items: [
      {
        id: 'item_ready_1',
        product_name: 'Luxury Arabian Incense Set',
        sku_code: 'INC-SET-01',
        quantity: 1,
        unit_price: 25000,
        total_price: 25000,
        source: 'supplier_backed'
      }
    ],
    timeline: [
      {
        id: 'tl_1',
        type: 'confirmed',
        detail: 'Order confirmed',
        created_at: '2026-09-30T10:00:00Z'
      },
      {
        id: 'tl_2',
        type: 'processing',
        detail: 'Started processing',
        created_at: '2026-09-30T10:15:00Z'
      },
      {
        id: 'tl_3',
        type: 'ready_for_shipping',
        detail: 'Packed and ready for shipping',
        created_at: '2026-09-30T10:30:00Z'
      }
    ],
    allowed_next_actions: ['shipped'],
    created_at: '2026-09-30T10:00:00Z',
    updated_at: '2026-09-30T10:30:00Z'
  };

  it('renders "Create Shipment" button for orders in ready_for_shipping status', async () => {
    vi.mocked(sellerApi.getStoreOrderDetail).mockResolvedValue(mockReadyOrder);

    render(<StoreOrderDetailPage params={{ store_id: 'str_1', order_id: 'ord_ready_1' }} />);

    await waitFor(() => {
      expect(screen.getByText('Create Shipment')).toBeInTheDocument();
    });
  });

  it('opens fulfillment modal, accepts carrier/tracking details, and submits transition to shipped', async () => {
    vi.mocked(sellerApi.getStoreOrderDetail).mockResolvedValue(mockReadyOrder);
    vi.mocked(sellerApi.transitionStoreOrder).mockResolvedValue({
      ...mockReadyOrder,
      status: 'shipped',
      timeline: [
        ...mockReadyOrder.timeline,
        {
          id: 'tl_4',
          type: 'shipped',
          detail: 'Carrier: Fetchr Express, Tracking: TRK-998877 - Notes: Morning dispatch batch',
          created_at: '2026-09-30T11:00:00Z'
        }
      ]
    });

    render(<StoreOrderDetailPage params={{ store_id: 'str_1', order_id: 'ord_ready_1' }} />);

    await waitFor(() => {
      expect(screen.getByText('Create Shipment')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Create Shipment'));

    expect(screen.getByText(/Manual Package Dispatch & Fulfillment/)).toBeInTheDocument();

    const carrierInput = screen.getByPlaceholderText(/Local Courier/i);
    fireEvent.change(carrierInput, { target: { value: 'Fetchr Express' } });

    const trackingInput = screen.getByPlaceholderText(/TRK-/i);
    fireEvent.change(trackingInput, { target: { value: 'TRK-998877' } });

    const notesInput = screen.getByPlaceholderText(/Handed over to driver/i);
    fireEvent.change(notesInput, { target: { value: 'Morning dispatch batch' } });

    fireEvent.click(screen.getByText('Mark as Shipped'));

    await waitFor(() => {
      expect(sellerApi.transitionStoreOrder).toHaveBeenCalledWith('str_1', 'ord_ready_1', {
        target_status: 'shipped',
        reason: 'Carrier: Fetchr Express, Tracking: TRK-998877 - Notes: Morning dispatch batch'
      });
    });
  });

  it('renders "Confirm Delivery" button for orders in shipped status and transitions to delivered', async () => {
    const mockShippedOrder: SellerOrderDetail = {
      ...mockReadyOrder,
      status: 'shipped',
      allowed_next_actions: ['delivered']
    };

    vi.mocked(sellerApi.getStoreOrderDetail).mockResolvedValue(mockShippedOrder);
    vi.mocked(sellerApi.transitionStoreOrder).mockResolvedValue({
      ...mockShippedOrder,
      status: 'delivered'
    });

    render(<StoreOrderDetailPage params={{ store_id: 'str_1', order_id: 'ord_ready_1' }} />);

    await waitFor(() => {
      expect(screen.getByText('Confirm Delivery')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Confirm Delivery'));

    await waitFor(() => {
      expect(sellerApi.transitionStoreOrder).toHaveBeenCalledWith('str_1', 'ord_ready_1', {
        target_status: 'delivered',
        reason: undefined
      });
    });
  });
});
