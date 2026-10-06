import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StoreInventoryPage from '../app/(dashboard)/dashboard/stores/[store_id]/inventory/page';
import { sellerApi } from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  sellerApi: {
    listStoreInventory: vi.fn(),
    listStoreLocations: vi.fn(),
    listStoreProducts: vi.fn(),
    adjustInventory: vi.fn(),
  }
}));

describe('StoreInventoryPage - Dual Mode Adjustments & Selectors', () => {
  const mockStoreId = 'str_test_123';
  const mockLocation = {
    id: 'loc_wh_1',
    code: 'WH-01',
    name: 'Main Logistics Warehouse',
    location_type: 'warehouse',
    status: 'active'
  };
  const mockSnapshot = {
    id: 'snap_1',
    fulfillment_location_id: 'loc_wh_1',
    location_name: 'Main Logistics Warehouse',
    sku_id: 'sku_tshirt_blue',
    sku_code: 'TSHIRT-BLU-L',
    on_hand_qty: 20,
    reserved_qty: 5,
    available_qty: 15,
    version: 1,
    updated_at: '2026-10-06T10:00:00Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sellerApi.listStoreInventory).mockResolvedValue({ items: [mockSnapshot] });
    vi.mocked(sellerApi.listStoreLocations).mockResolvedValue({ items: [mockLocation] });
    vi.mocked(sellerApi.listStoreProducts).mockResolvedValue({ items: [] });
  });

  it('renders SKU and Location dropdown selectors instead of raw text inputs', async () => {
    render(<StoreInventoryPage params={{ store_id: mockStoreId }} />);

    await waitFor(() => {
      expect(screen.getByText('Store Inventory Snapshots')).toBeInTheDocument();
    });

    const skuSelect = screen.getByTestId('sku-select');
    const locationSelect = screen.getByTestId('location-select');

    expect(skuSelect).toBeInTheDocument();
    expect(locationSelect).toBeInTheDocument();
    expect(screen.getAllByText(/Main Logistics Warehouse/).length).toBeGreaterThanOrEqual(1);
  });

  it('submits relative delta adjustment with selected reason code', async () => {
    vi.mocked(sellerApi.adjustInventory).mockResolvedValue({
      snapshot_id: 'snap_1',
      fulfillment_location_id: 'loc_wh_1',
      sku_id: 'sku_tshirt_blue',
      on_hand_qty: 35,
      reserved_qty: 5,
      available_qty: 30,
      quantity_delta: 15,
      movement_id: 'mov_1',
      reason_code: 'received_stock',
      updated_at: '2026-10-06T10:05:00Z'
    });

    render(<StoreInventoryPage params={{ store_id: mockStoreId }} />);

    await waitFor(() => {
      expect(screen.getByTestId('sku-select')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('sku-select'), { target: { value: 'sku_tshirt_blue' } });
    fireEvent.change(screen.getByTestId('location-select'), { target: { value: 'loc_wh_1' } });
    fireEvent.change(screen.getByTestId('qty-delta-input'), { target: { value: '15' } });
    fireEvent.change(screen.getByTestId('reason-code-select'), { target: { value: 'received_stock' } });

    fireEvent.click(screen.getByText('Apply Adjustment'));

    await waitFor(() => {
      expect(sellerApi.adjustInventory).toHaveBeenCalledWith(
        mockStoreId,
        expect.objectContaining({
          fulfillment_location_id: 'loc_wh_1',
          sku_id: 'sku_tshirt_blue',
          qty_delta: 15,
          reason_code: 'received_stock'
        })
      );
    });

    expect(await screen.findByTestId('success-banner')).toBeInTheDocument();
  });

  it('toggles to cycle count mode and submits absolute target quantity', async () => {
    vi.mocked(sellerApi.adjustInventory).mockResolvedValue({
      snapshot_id: 'snap_1',
      fulfillment_location_id: 'loc_wh_1',
      sku_id: 'sku_tshirt_blue',
      on_hand_qty: 50,
      reserved_qty: 5,
      available_qty: 45,
      quantity_delta: 30,
      movement_id: 'mov_2',
      reason_code: 'cycle_count_reconciliation',
      updated_at: '2026-10-06T10:06:00Z'
    });

    render(<StoreInventoryPage params={{ store_id: mockStoreId }} />);

    await waitFor(() => {
      expect(screen.getByTestId('mode-cycle-count-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('mode-cycle-count-btn'));

    expect(screen.getByTestId('target-qty-input')).toBeInTheDocument();
    expect(screen.queryByTestId('qty-delta-input')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('sku-select'), { target: { value: 'sku_tshirt_blue' } });
    fireEvent.change(screen.getByTestId('location-select'), { target: { value: 'loc_wh_1' } });
    fireEvent.change(screen.getByTestId('target-qty-input'), { target: { value: '50' } });

    fireEvent.click(screen.getByText('Reconcile Count'));

    await waitFor(() => {
      expect(sellerApi.adjustInventory).toHaveBeenCalledWith(
        mockStoreId,
        expect.objectContaining({
          fulfillment_location_id: 'loc_wh_1',
          sku_id: 'sku_tshirt_blue',
          target_qty: 50,
          reason_code: 'cycle_count_reconciliation'
        })
      );
    });

    expect(await screen.findByTestId('success-banner')).toBeInTheDocument();
  });

  it('prefills form inputs when clicking Select for Adjust in table', async () => {
    render(<StoreInventoryPage params={{ store_id: mockStoreId }} />);

    await waitFor(() => {
      expect(screen.getByText('Select for Adjust')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select for Adjust'));

    expect(screen.getByTestId('sku-select')).toHaveValue('sku_tshirt_blue');
    expect(screen.getByTestId('location-select')).toHaveValue('loc_wh_1');
  });

  it('renders inline error banner when API returns error without native alert()', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.mocked(sellerApi.adjustInventory).mockRejectedValue(new Error('Insufficient stock: cannot reduce below reserved'));

    render(<StoreInventoryPage params={{ store_id: mockStoreId }} />);

    await waitFor(() => {
      expect(screen.getByTestId('sku-select')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('sku-select'), { target: { value: 'sku_tshirt_blue' } });
    fireEvent.change(screen.getByTestId('location-select'), { target: { value: 'loc_wh_1' } });

    fireEvent.click(screen.getByText('Apply Adjustment'));

    await waitFor(() => {
      expect(screen.getByTestId('error-banner')).toBeInTheDocument();
      expect(screen.getByText(/Insufficient stock/)).toBeInTheDocument();
    });

    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
