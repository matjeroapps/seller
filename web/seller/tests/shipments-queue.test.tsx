import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ShipmentsOverviewScreen } from '@/components/seller/ShipmentsOverviewScreen';
import { sellerApi } from '@/lib/api/client';
import type { Shipment, StoreShipmentsResponse } from '@/lib/api/types';

vi.mock('@/lib/api/client', () => ({
  sellerApi: {
    listStoreShipments: vi.fn(),
    createStoreShipment: vi.fn(),
  },
}));

const mockShipments: Shipment[] = [
  {
    id: 'shp_1',
    order_id: 'ord_1001',
    fulfillment_location_id: 'loc_main',
    status: 'PENDING',
    carrier_name: 'SMSA Express',
    tracking_number: 'SMSA-998877',
    shipping_cost_minor: 2500,
    cod_amount_minor: 0,
    currency: 'SAR',
    items: [{ id: 'item_1', shipment_id: 'shp_1', order_item_id: 'oit_1', quantity: 2, created_at: '2026-10-01' }],
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
  },
  {
    id: 'shp_2',
    order_id: 'ord_1002',
    fulfillment_location_id: 'loc_main',
    status: 'SHIPPED',
    carrier_name: 'Aramex',
    tracking_number: 'TRK-ord_1002-abc123',
    shipping_cost_minor: 1500,
    cod_amount_minor: 5000,
    currency: 'SAR',
    items: [{ id: 'item_2', shipment_id: 'shp_2', order_item_id: 'oit_2', quantity: 1, created_at: '2026-10-02' }],
    created_at: '2026-10-02T12:00:00Z',
    updated_at: '2026-10-02T12:00:00Z',
  },
];

describe('ShipmentsOverviewScreen — Store-Wide Fulfillment Queue (US4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders store shipments queue with tracking numbers, carriers, and statuses', async () => {
    vi.mocked(sellerApi.listStoreShipments).mockResolvedValue({
      items: mockShipments,
      total_count: 2,
      page: 1,
      page_size: 50,
    });

    render(<ShipmentsOverviewScreen storeId="str_test_1" />);

    await waitFor(() => {
      expect(screen.getByText('Store Shipments Queue')).toBeInTheDocument();
      expect(screen.getByText('SMSA-998877')).toBeInTheDocument();
      expect(screen.getByText('TRK-ord_1002-abc123')).toBeInTheDocument();
      expect(screen.getByText('SMSA Express')).toBeInTheDocument();
      expect(screen.getByText('Aramex')).toBeInTheDocument();
      expect(screen.getByText('ord_1001')).toBeInTheDocument();
      expect(screen.getByText('ord_1002')).toBeInTheDocument();
    });

    expect(sellerApi.listStoreShipments).toHaveBeenCalledWith('str_test_1', {
      status: undefined,
      page: 1,
      limit: 50,
    });
  });

  it('filters shipments by status when status filter buttons are clicked', async () => {
    vi.mocked(sellerApi.listStoreShipments).mockResolvedValue({
      items: [mockShipments[0]],
      total_count: 1,
      page: 1,
      page_size: 50,
    });

    render(<ShipmentsOverviewScreen storeId="str_test_1" />);

    await waitFor(() => {
      expect(screen.getByText('Store Shipments Queue')).toBeInTheDocument();
    });

    // Click PENDING filter button
    fireEvent.click(screen.getByRole('button', { name: 'PENDING' }));

    await waitFor(() => {
      expect(sellerApi.listStoreShipments).toHaveBeenCalledWith('str_test_1', {
        status: 'PENDING',
        page: 1,
        limit: 50,
      });
    });
  });

  it('renders empty state when no shipments are found in the active status', async () => {
    vi.mocked(sellerApi.listStoreShipments).mockResolvedValue({
      items: [],
      total_count: 0,
      page: 1,
      page_size: 50,
    });

    render(<ShipmentsOverviewScreen storeId="str_test_1" />);

    await waitFor(() => {
      expect(screen.getByText('No shipments found in this status')).toBeInTheDocument();
      expect(screen.getByText('View Store Orders')).toBeInTheDocument();
    });
  });

  it('opens CreateShipmentModal and creates a shipment with auto-generated tracking code', async () => {
    vi.mocked(sellerApi.listStoreShipments).mockResolvedValue({
      items: [],
      total_count: 0,
      page: 1,
      page_size: 50,
    });

    vi.mocked(sellerApi.createStoreShipment).mockResolvedValue({
      id: 'shp_new_auto',
      order_id: 'ord_9999',
      fulfillment_location_id: 'loc_main',
      status: 'PENDING',
      tracking_number: 'TRK-ord_9999-new01',
      shipping_cost_minor: 1500,
      cod_amount_minor: 0,
      currency: 'SAR',
      items: [],
      created_at: '2026-10-06T12:00:00Z',
      updated_at: '2026-10-06T12:00:00Z',
    });

    render(<ShipmentsOverviewScreen storeId="str_test_1" />);

    await waitFor(() => {
      expect(screen.getByText('Store Shipments Queue')).toBeInTheDocument();
    });

    // Click "Create Shipment" in header
    fireEvent.click(screen.getAllByRole('button', { name: /Create Shipment/i })[0]);

    // Modal opens
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Dispatch an order shipment with optional courier tracking or auto-generated code')).toBeInTheDocument();
    });

    // Fill form without tracking code or carrier to test auto TRK- generation
    fireEvent.change(screen.getByLabelText(/Order ID/i), { target: { value: 'ord_9999' } });
    fireEvent.change(screen.getByLabelText(/Order Item ID 1/i), { target: { value: 'oit_sample_1' } });

    // Submit modal form
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Shipment' }));

    await waitFor(() => {
      expect(sellerApi.createStoreShipment).toHaveBeenCalledWith('str_test_1', {
        order_id: 'ord_9999',
        fulfillment_location_id: 'loc_main',
        carrier_name: undefined,
        tracking_number: undefined,
        shipping_cost_minor: 1500,
        cod_amount_minor: 0,
        currency: 'SAR',
        items: [{ order_item_id: 'oit_sample_1', quantity: 1 }],
      });
    });

    // Success banner appears with auto tracking code
    await waitFor(() => {
      expect(screen.getByText(/Shipment created successfully with tracking code TRK-ord_9999-new01/i)).toBeInTheDocument();
    });
  });

  it('creates shipment with custom carrier and explicit tracking number', async () => {
    vi.mocked(sellerApi.listStoreShipments).mockResolvedValue({
      items: [],
      total_count: 0,
      page: 1,
      page_size: 50,
    });

    vi.mocked(sellerApi.createStoreShipment).mockResolvedValue({
      id: 'shp_new_dhl',
      order_id: 'ord_8888',
      fulfillment_location_id: 'loc_main',
      status: 'PENDING',
      carrier_name: 'DHL Express',
      tracking_number: 'DHL-123456789',
      shipping_cost_minor: 3000,
      cod_amount_minor: 0,
      currency: 'SAR',
      items: [],
      created_at: '2026-10-06T12:00:00Z',
      updated_at: '2026-10-06T12:00:00Z',
    });

    render(<ShipmentsOverviewScreen storeId="str_test_1" />);

    // Click "Create Shipment"
    fireEvent.click(screen.getAllByRole('button', { name: /Create Shipment/i })[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Order ID/i), { target: { value: 'ord_8888' } });
    fireEvent.change(screen.getByLabelText(/Carrier Name/i), { target: { value: 'DHL Express' } });
    fireEvent.change(screen.getByLabelText(/Tracking Number/i), { target: { value: 'DHL-123456789' } });
    fireEvent.change(screen.getByLabelText(/Shipping Fee/i), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText(/Order Item ID 1/i), { target: { value: 'oit_dhl_1' } });

    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Shipment' }));

    await waitFor(() => {
      expect(sellerApi.createStoreShipment).toHaveBeenCalledWith('str_test_1', {
        order_id: 'ord_8888',
        fulfillment_location_id: 'loc_main',
        carrier_name: 'DHL Express',
        tracking_number: 'DHL-123456789',
        shipping_cost_minor: 3000,
        cod_amount_minor: 0,
        currency: 'SAR',
        items: [{ order_item_id: 'oit_dhl_1', quantity: 1 }],
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Shipment created successfully with tracking code DHL-123456789/i)).toBeInTheDocument();
    });
  });
});
