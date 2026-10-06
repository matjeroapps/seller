import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import StoreListingDetailPage from '../app/(dashboard)/dashboard/stores/[store_id]/catalog/listings/[listing_id]/page';
import StoreSupplierOffersPage from '../app/(dashboard)/dashboard/stores/[store_id]/catalog/supplier-offers/page';
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
    getStoreListing: vi.fn(),
    getStoreListingLifecycle: vi.fn(),
    getListingReadiness: vi.fn(),
    updateListingPrice: vi.fn(),
    publishListing: vi.fn(),
    unpublishListing: vi.fn(),
    archiveListing: vi.fn(),
    listStoreSupplierOffers: vi.fn(),
    importSupplierOffer: vi.fn()
  }
}));

describe('SDS-2 — Seller Catalog Economics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Listing Detail Economics', () => {
    it('renders wholesale price context, markup % presets, and margin summary', async () => {
      vi.mocked(sellerApi.getStoreListing).mockResolvedValue({
        id: 'lst_101',
        store_id: 'str_1',
        product_id: 'prod_101',
        market_code: 'SA',
        status: 'draft',
        created_at: '2026-10-01',
        updated_at: '2026-10-01'
      });
      vi.mocked(sellerApi.getStoreListingLifecycle).mockResolvedValue({
        listing_id: 'lst_101',
        store_id: 'str_1',
        status: 'draft',
        effective_availability: 'available',
        is_upstream_available: true,
        has_margin_warning: false,
        current_retail_price: { currency: 'SAR', amount_minor: 12000 },
        upstream_wholesale_price: { currency: 'SAR', amount_minor: 10000 },
        last_synced_at: '2026-10-01'
      });
      vi.mocked(sellerApi.getListingReadiness).mockResolvedValue({ is_ready: true, reasons: [] });

      render(<StoreListingDetailPage params={{ store_id: 'str_1', listing_id: 'lst_101' }} />);

      await waitFor(() => {
        expect(screen.getByText(/Percentage Markup & Retail Merchandising/i)).toBeInTheDocument();
        expect(screen.getByText(/Quick Markup Presets/i)).toBeInTheDocument();
        expect(screen.getByText('100.00 SAR')).toBeInTheDocument(); // Wholesale 10000 cents = 100 SAR
      });
    });

    it('renders Unsafe Margin Warning when net margin is negative and restricts publish action', async () => {
      vi.mocked(sellerApi.getStoreListing).mockResolvedValue({
        id: 'lst_102',
        store_id: 'str_1',
        product_id: 'prod_102',
        market_code: 'SA',
        status: 'draft',
        created_at: '2026-10-01',
        updated_at: '2026-10-01'
      });
      vi.mocked(sellerApi.getStoreListingLifecycle).mockResolvedValue({
        listing_id: 'lst_102',
        store_id: 'str_1',
        status: 'draft',
        effective_availability: 'available',
        is_upstream_available: true,
        has_margin_warning: true,
        current_retail_price: { currency: 'SAR', amount_minor: 8000 }, // Retail 80 SAR
        upstream_wholesale_price: { currency: 'SAR', amount_minor: 10000 }, // Wholesale 100 SAR -> Loss!
        last_synced_at: '2026-10-01'
      });
      vi.mocked(sellerApi.getListingReadiness).mockResolvedValue({ is_ready: true, reasons: [] });

      render(<StoreListingDetailPage params={{ store_id: 'str_1', listing_id: 'lst_102' }} />);

      await waitFor(() => {
        expect(screen.getByText(/Unsafe Merchant Margin Warning/i)).toBeInTheDocument();
      });

      const publishBtn = screen.getByRole('button', { name: /Publish Listing/i });
      expect(publishBtn).toBeDisabled();
    });
  });

  describe('Supplier Offer Import Modal & Pricing Configuration', () => {
    it('opens import configuration modal and submits import with calculated markup', async () => {
      vi.mocked(sellerApi.listStoreSupplierOffers).mockResolvedValue({
        items: [
          {
            offer_id: 'off_99',
            offer_status: 'active',
            market_code: 'SA',
            product_id: 'prod_99',
            product_slug: 'perfume-99',
            product_name: 'Luxury Oud 50ml',
            product_status: 'published',
            supplier_id: 'sup_1',
            supplier_code: 'sup-a',
            supplier_name: 'Arabian Oils Co',
            price: { currency: 'SAR', amount_minor: 20000 },
            is_available: true,
            available_qty: 50,
            fulfillment_count: 1,
            updated_at: '2026-10-01'
          }
        ]
      });
      vi.mocked(sellerApi.importSupplierOffer).mockResolvedValue({
        id: 'lst_imported_99',
        store_id: 'str_1',
        product_id: 'prod_99',
        market_code: 'SA',
        status: 'draft',
        created_at: '2026-10-01',
        updated_at: '2026-10-01'
      });

      render(<StoreSupplierOffersPage params={{ store_id: 'str_1' }} />);

      await waitFor(() => {
        expect(screen.getByText('Luxury Oud 50ml')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Import to Store Catalog'));

      await waitFor(() => {
        expect(screen.getByText('Configure Supplier Offer Import & Markup')).toBeInTheDocument();
        expect(screen.getByText(/Target Markup Percentage/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm & Import to Store Catalog'));

      await waitFor(() => {
        expect(sellerApi.importSupplierOffer).toHaveBeenCalledWith('str_1', 'off_99', {
          markup_percentage: 20,
          retail_price_minor_units: 24000,
          shipping_subsidy_policy: 'buyer_paid'
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/Offer imported atomically with 20% markup/i)).toBeInTheDocument();
      });
    });
  });
});
