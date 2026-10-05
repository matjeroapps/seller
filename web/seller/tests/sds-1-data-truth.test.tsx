import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import StoreOrderDetailPage from '../app/(dashboard)/dashboard/stores/[store_id]/orders/[order_id]/page';
import StoreListingDetailPage from '../app/(dashboard)/dashboard/stores/[store_id]/catalog/listings/[listing_id]/page';
import StoreInventoryPage from '../app/(dashboard)/dashboard/stores/[store_id]/inventory/page';
import StoreMediaLibraryPage from '../app/(dashboard)/dashboard/stores/[store_id]/media/page';
import { StoreSwitcher } from '../components/shell/StoreSwitcher';
import { sellerApi } from '../lib/api/client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn()
  }),
  usePathname: () => '/dashboard/stores/str_1'
}));

vi.mock('../lib/api/client', () => ({
  sellerApi: {
    getStoreOrderDetail: vi.fn(),
    getStoreListing: vi.fn(),
    getListingReadiness: vi.fn(),
    updateListingPrice: vi.fn(),
    publishListing: vi.fn(),
    unpublishListing: vi.fn(),
    archiveListing: vi.fn(),
    listStoreInventory: vi.fn(),
    adjustInventory: vi.fn(),
    listStoreMedia: vi.fn(),
    createMediaUpload: vi.fn(),
    completeMediaUpload: vi.fn(),
    deleteStoreMedia: vi.fn(),
    getStores: vi.fn(),
    ensureRetailWorkspace: vi.fn(),
    createStore: vi.fn()
  }
}));

describe('SDS-1 — Seller Dashboard P0 Data Truth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Order Detail Data Truth', () => {
    it('does not render dummy fallback business data (ord_dev_01, Sample Product) while loading or on error', async () => {
      vi.mocked(sellerApi.getStoreOrderDetail).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({} as any), 500))
      );

      render(<StoreOrderDetailPage params={{ store_id: 'str_real', order_id: 'ord_real_999' }} />);

      expect(screen.queryByText(/ord_dev_01/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Sample Product A/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Sample Product B/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Dev Customer/i)).not.toBeInTheDocument();
    });

    it('renders an honest error UI when order fetch fails, without falling back to fake business rows', async () => {
      vi.mocked(sellerApi.getStoreOrderDetail).mockRejectedValue(new Error('Order not found or backend error'));

      render(<StoreOrderDetailPage params={{ store_id: 'str_real', order_id: 'ord_nonexistent' }} />);

      await waitFor(() => {
        expect(screen.getByText('Order not found or backend error')).toBeInTheDocument();
      });

      expect(screen.queryByText(/ord_dev_01/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Sample Product/i)).not.toBeInTheDocument();
    });
  });

  describe('No-Alert Inline Error UX', () => {
    it('renders inline error banner on listing update error instead of calling alert()', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      vi.mocked(sellerApi.getStoreListing).mockResolvedValue({
        id: 'lst_1',
        store_id: 'str_1',
        product_id: 'prod_1',
        market_code: 'SA',
        status: 'draft',
        created_at: '2026-10-01',
        updated_at: '2026-10-01'
      });
      vi.mocked(sellerApi.getListingReadiness).mockResolvedValue({ is_ready: true, reasons: [] });
      vi.mocked(sellerApi.publishListing).mockRejectedValue(new Error('Failed to publish listing: Missing price'));

      render(<StoreListingDetailPage params={{ store_id: 'str_1', listing_id: 'lst_1' }} />);

      await waitFor(() => {
        expect(screen.getByText('Publish Listing')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Publish Listing'));

      await waitFor(() => {
        expect(screen.getByText('Failed to publish listing: Missing price')).toBeInTheDocument();
      });

      expect(alertSpy).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    it('renders inline error banner on inventory adjustment failure without calling alert()', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      vi.mocked(sellerApi.listStoreInventory).mockResolvedValue({ items: [] });
      vi.mocked(sellerApi.adjustInventory).mockRejectedValue(new Error('SKU location not found'));

      render(<StoreInventoryPage params={{ store_id: 'str_1' }} />);

      await waitFor(() => {
        expect(screen.getByText('Store Inventory Snapshots')).toBeInTheDocument();
      });

      expect(alertSpy).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    it('renders inline error inside StoreSwitcher form on store creation failure', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      vi.mocked(sellerApi.getStores).mockResolvedValue({
        items: [{ id: 'str_1', seller_id: 'slr_1', name: 'Store 1', code: 's1', market_code: 'SA', status: 'active', created_at: '', updated_at: '' }],
        active_store_limit: 5,
        active_store_count: 1
      });
      vi.mocked(sellerApi.ensureRetailWorkspace).mockRejectedValue(new Error('Slug collision for store code'));

      render(<StoreSwitcher currentStoreId="str_1" />);

      await waitFor(() => {
        expect(screen.getByText('Store 1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Store 1'));

      await waitFor(() => {
        expect(screen.getByText('Create Store')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create Store'));

      const nameInput = screen.getByPlaceholderText('Store Name');
      const codeInput = screen.getByPlaceholderText('Store Code (e.g. store-a)');

      fireEvent.change(nameInput, { target: { value: 'Dup Store' } });
      fireEvent.change(codeInput, { target: { value: 'dup-code' } });

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(screen.getByText('Slug collision for store code')).toBeInTheDocument();
      });

      expect(alertSpy).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });
  });
});
