import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import StoreOrdersPage, { getStatusBadge } from '../app/(dashboard)/dashboard/stores/[store_id]/orders/page';
import StoreOrderDetailPage from '../app/(dashboard)/dashboard/stores/[store_id]/orders/[order_id]/page';
import { sellerApi } from '../lib/api/client';
import type { SellerOrderListResponse, SellerOrderDetail } from '../lib/api/types';

vi.mock('../lib/api/client', () => ({
  sellerApi: {
    listStoreOrders: vi.fn(),
    getStoreOrderDetail: vi.fn(),
    transitionStoreOrder: vi.fn()
  }
}));

describe('Seller Orders Management (M6-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStatusBadge Helper', () => {
    it('renders correct badges for statuses', () => {
      render(<div>{getStatusBadge('confirmed')}</div>);
      expect(screen.getByText('Confirmed')).toBeInTheDocument();

      render(<div>{getStatusBadge('ready_for_shipping')}</div>);
      expect(screen.getByText('Ready for Shipping')).toBeInTheDocument();

      render(<div>{getStatusBadge('shipped')}</div>);
      expect(screen.getByText('Shipped')).toBeInTheDocument();
    });
  });

  describe('StoreOrdersPage (Order Queue)', () => {
    const mockOrderList: SellerOrderListResponse = {
      orders: [
        {
          id: 'ord_123',
          order_number: 'ORD-2026-0001',
          status: 'confirmed',
          currency: 'SAR',
          total: 15000,
          item_count: 2,
          recipient_name: 'Fahad Al-Otaibi',
          created_at: '2026-09-30T10:00:00Z'
        }
      ],
      total: 1,
      limit: 20,
      offset: 0
    };

    it('renders order queue list with customer and price details', async () => {
      vi.mocked(sellerApi.listStoreOrders).mockResolvedValue(mockOrderList);

      render(<StoreOrdersPage params={{ store_id: 'str_1' }} />);

      await waitFor(() => {
        expect(screen.getByText(/Fahad Al-Otaibi/)).toBeInTheDocument();
        expect(screen.getByText(/150\.00 SAR/)).toBeInTheDocument();
        expect(screen.getByText(/ORD-2026-0001/)).toBeInTheDocument();
      });
    });

    it('handles status tab selection filter', async () => {
      vi.mocked(sellerApi.listStoreOrders).mockResolvedValue(mockOrderList);

      render(<StoreOrdersPage params={{ store_id: 'str_1' }} />);

      await waitFor(() => {
        expect(screen.getByText('Processing')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Processing'));

      await waitFor(() => {
        expect(sellerApi.listStoreOrders).toHaveBeenCalledWith('str_1', {
          status: 'processing',
          query: undefined
        });
      });
    });
  });

  describe('StoreOrderDetailPage (Order Detail & Actions)', () => {
    const mockDetail: SellerOrderDetail = {
      id: 'ord_123',
      order_number: 'ORD-2026-0001',
      status: 'confirmed',
      currency: 'SAR',
      subtotal: 13000,
      total: 15000,
      item_count: 1,
      contact_email: 'fahad@example.com',
      shipping_address: {
        recipient_name: 'Fahad Al-Otaibi',
        phone: '+966500000001',
        address_line_1: 'King Fahd Road',
        city: 'Riyadh',
        country_code: 'SA'
      },
      items: [
        {
          id: 'item_1',
          product_name: 'Arabian Musk 100ml',
          sku_code: 'MUSK-100',
          quantity: 1,
          unit_price: 13000,
          total_price: 13000,
          source: 'seller_owned'
        }
      ],
      timeline: [
        {
          id: 'tl_1',
          type: 'confirmed',
          detail: 'Order confirmed via Cash on Delivery policy',
          created_at: '2026-09-30T10:00:00Z'
        }
      ],
      allowed_next_actions: ['processing', 'cancelled'],
      created_at: '2026-09-30T10:00:00Z',
      updated_at: '2026-09-30T10:00:00Z'
    };

    it('renders complete order information and action buttons', async () => {
      vi.mocked(sellerApi.getStoreOrderDetail).mockResolvedValue(mockDetail);

      render(<StoreOrderDetailPage params={{ store_id: 'str_1', order_id: 'ord_123' }} />);

      await waitFor(() => {
        expect(screen.getByText('Order ORD-2026-0001')).toBeInTheDocument();
        expect(screen.getByText('Arabian Musk 100ml')).toBeInTheDocument();
        expect(screen.getByText('fahad@example.com')).toBeInTheDocument();
        expect(screen.getByText('King Fahd Road')).toBeInTheDocument();
        expect(screen.getByText('Start Processing')).toBeInTheDocument();
        expect(screen.getByText('Cancel Order')).toBeInTheDocument();
      });
    });

    it('triggers transition to processing when Start Processing is clicked', async () => {
      vi.mocked(sellerApi.getStoreOrderDetail).mockResolvedValue(mockDetail);
      vi.mocked(sellerApi.transitionStoreOrder).mockResolvedValue({
        ...mockDetail,
        status: 'processing'
      });

      render(<StoreOrderDetailPage params={{ store_id: 'str_1', order_id: 'ord_123' }} />);

      await waitFor(() => {
        expect(screen.getByText('Start Processing')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Start Processing'));

      await waitFor(() => {
        expect(sellerApi.transitionStoreOrder).toHaveBeenCalledWith('str_1', 'ord_123', {
          target_status: 'processing',
          reason: undefined
        });
      });
    });

    it('opens cancellation modal and submits cancellation with reason', async () => {
      vi.mocked(sellerApi.getStoreOrderDetail).mockResolvedValue(mockDetail);
      vi.mocked(sellerApi.transitionStoreOrder).mockResolvedValue({
        ...mockDetail,
        status: 'cancelled'
      });

      render(<StoreOrderDetailPage params={{ store_id: 'str_1', order_id: 'ord_123' }} />);

      await waitFor(() => {
        expect(screen.getByText('Cancel Order')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Cancel Order'));

      expect(screen.getByText('Confirm Cancellation')).toBeInTheDocument();

      const textarea = screen.getByPlaceholderText(/Customer requested cancellation/i);
      fireEvent.change(textarea, { target: { value: 'Customer requested cancellation' } });

      fireEvent.click(screen.getByText('Confirm Cancellation'));

      await waitFor(() => {
        expect(sellerApi.transitionStoreOrder).toHaveBeenCalledWith('str_1', 'ord_123', {
          target_status: 'cancelled',
          reason: 'Customer requested cancellation'
        });
      });
    });
  });
});
