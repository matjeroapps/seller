import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import StoreListingDetailPage from '../app/(dashboard)/dashboard/stores/[store_id]/catalog/listings/[listing_id]/page';
import StoreSupplierOffersPage from '../app/(dashboard)/dashboard/stores/[store_id]/catalog/supplier-offers/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/dashboard/stores/store_123/catalog/listings/listing_456',
}));

const { mockApi } = vi.hoisted(() => {
  const mockApi = {
    getStoreListing: vi.fn(),
    getStores: vi.fn(),
    getStoreListingLifecycle: vi.fn(),
    getListingReadiness: vi.fn(),
    updateListingPrice: vi.fn(),
    publishListing: vi.fn(),
    unpublishListing: vi.fn(),
    archiveListing: vi.fn(),
    listStoreSupplierOffers: vi.fn(),
    importSupplierOffer: vi.fn(),
  };
  return { mockApi };
});

vi.mock('../lib/api/client', () => ({
  sellerApi: mockApi,
  sellerClient: mockApi,
}));

describe('Margin Guardrails & Atomic Imports (T035-T038)', () => {
  const storeId = 'store_test_123';
  const listingId = 'listing_test_456';

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getStores.mockResolvedValue({ items: [] });
  });

  describe('Listing Detail Page Margin Guardrail & Owner Override', () => {
    it('uses the store market currency and only offers that currency for pricing', async () => {
      mockApi.getStoreListing.mockResolvedValue({
        id: listingId,
        store_id: storeId,
        product_id: 'prod_123',
        status: 'draft',
        market_code: 'EG',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      mockApi.getStores.mockResolvedValue({
        items: [{
          id: storeId,
          seller_id: 'seller_123',
          market_code: 'EG',
          code: 'eg-store',
          name: 'Egypt Store',
          status: 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }],
        active_store_limit: 5,
        active_store_count: 0,
      });
      mockApi.getStoreListingLifecycle.mockResolvedValue({
        listing_id: listingId,
        store_id: storeId,
        status: 'draft',
        effective_availability: 'available',
        is_upstream_available: true,
        has_margin_warning: false,
        last_synced_at: new Date().toISOString(),
      });
      mockApi.getListingReadiness.mockResolvedValue({ is_ready: true, reasons: [] });

      await act(async () => {
        render(<StoreListingDetailPage params={{ store_id: storeId, listing_id: listingId }} />);
      });

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      const currencySelect = screen.getByRole('combobox') as HTMLSelectElement;
      expect(currencySelect.value).toBe('EGP');
      expect(screen.getByRole('option', { name: 'EGP' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'SAR' })).toBeNull();
    });

    it('does not display sub-wholesale override panel when retail price >= wholesale cost', async () => {
      mockApi.getStoreListing.mockResolvedValue({
        id: listingId,
        store_id: storeId,
        product_id: 'prod_123',
        status: 'draft',
        market_code: 'SA',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      mockApi.getStoreListingLifecycle.mockResolvedValue({
        listing_id: listingId,
        store_id: storeId,
        status: 'draft',
        effective_availability: 'available',
        is_upstream_available: true,
        has_margin_warning: false,
        current_retail_price: { amount_minor: 12000, currency: 'SAR' }, // 120 SAR
        upstream_wholesale_price: { amount_minor: 10000, currency: 'SAR' }, // 100 SAR
        last_synced_at: new Date().toISOString(),
      });
      mockApi.getListingReadiness.mockResolvedValue({
        is_ready: true,
        reasons: [],
      });

      await act(async () => {
        render(<StoreListingDetailPage params={{ store_id: storeId, listing_id: listingId }} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Listing Management/i)).toBeInTheDocument();
      });

      // Override panel should NOT be visible when price is 120 vs wholesale 100
      expect(screen.queryByTestId('sub-wholesale-override-panel')).toBeNull();
    });

    it('displays sub-wholesale override panel and blocks submit when retail < wholesale without authorization', async () => {
      mockApi.getStoreListing.mockResolvedValue({
        id: listingId,
        store_id: storeId,
        product_id: 'prod_123',
        status: 'draft',
        market_code: 'SA',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      mockApi.getStoreListingLifecycle.mockResolvedValue({
        listing_id: listingId,
        store_id: storeId,
        status: 'draft',
        effective_availability: 'available',
        is_upstream_available: true,
        has_margin_warning: true,
        current_retail_price: { amount_minor: 8000, currency: 'SAR' }, // 80 SAR (< 100 SAR)
        upstream_wholesale_price: { amount_minor: 10000, currency: 'SAR' }, // 100 SAR
        last_synced_at: new Date().toISOString(),
      });
      mockApi.getListingReadiness.mockResolvedValue({
        is_ready: false,
        reasons: [{ code: 'unsafe_margin', message: 'Retail price is below wholesale cost' }],
      });

      await act(async () => {
        render(<StoreListingDetailPage params={{ store_id: storeId, listing_id: listingId }} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('sub-wholesale-override-panel')).toBeInTheDocument();
      });

      expect(screen.getByText(/Store Owner Sub-Wholesale Margin Override/i)).toBeInTheDocument();

      // Submit without checking override
      const submitBtn = screen.getByRole('button', { name: /Save & Update Retail Price/i });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      expect(screen.getByText(/Sub-wholesale retail price requires store owner authorization and an audit reason/i)).toBeInTheDocument();
      expect(mockApi.updateListingPrice).not.toHaveBeenCalled();
    });

    it('successfully submits sub-wholesale price when owner override checkbox and audit reason are provided', async () => {
      mockApi.getStoreListing.mockResolvedValue({
        id: listingId,
        store_id: storeId,
        product_id: 'prod_123',
        status: 'draft',
        market_code: 'SA',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      mockApi.getStoreListingLifecycle.mockResolvedValue({
        listing_id: listingId,
        store_id: storeId,
        status: 'draft',
        effective_availability: 'available',
        is_upstream_available: true,
        has_margin_warning: true,
        current_retail_price: { amount_minor: 8000, currency: 'SAR' }, // 80 SAR
        upstream_wholesale_price: { amount_minor: 10000, currency: 'SAR' }, // 100 SAR
        last_synced_at: new Date().toISOString(),
      });
      mockApi.getListingReadiness.mockResolvedValue({ is_ready: false, reasons: [] });
      mockApi.updateListingPrice.mockResolvedValue({ status: 'updated' });

      await act(async () => {
        render(<StoreListingDetailPage params={{ store_id: storeId, listing_id: listingId }} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('sub-wholesale-override-panel')).toBeInTheDocument();
      });

      // Check the override checkbox
      const checkbox = screen.getByTestId('allow-sub-wholesale-checkbox');
      await act(async () => {
        fireEvent.click(checkbox);
      });

      // Audit reason input appears
      const auditInput = screen.getByTestId('audit-reason-input');
      expect(auditInput).toBeInTheDocument();

      await act(async () => {
        fireEvent.change(auditInput, { target: { value: 'Seasonal clearance liquidation' } });
      });

      // Submit
      const submitBtn = screen.getByRole('button', { name: /Save & Update Retail Price/i });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      expect(mockApi.updateListingPrice).toHaveBeenCalledWith(
        storeId,
        listingId,
        expect.objectContaining({
          currency: 'SAR',
          amount_minor: 8000,
          retail_price_minor_units: 8000,
          allow_sub_wholesale: true,
          audit_reason: 'Seasonal clearance liquidation',
        })
      );
    });

    it('displays error notification when backend rejects with unsafe_margin or non-owner forbidden', async () => {
      mockApi.getStoreListing.mockResolvedValue({
        id: listingId,
        store_id: storeId,
        product_id: 'prod_123',
        status: 'draft',
        market_code: 'SA',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      mockApi.getStoreListingLifecycle.mockResolvedValue({
        listing_id: listingId,
        store_id: storeId,
        status: 'draft',
        effective_availability: 'available',
        is_upstream_available: true,
        has_margin_warning: false,
        current_retail_price: { amount_minor: 10000, currency: 'SAR' },
        upstream_wholesale_price: { amount_minor: 10000, currency: 'SAR' },
        last_synced_at: new Date().toISOString(),
      });
      mockApi.getListingReadiness.mockResolvedValue({ is_ready: true, reasons: [] });
      mockApi.updateListingPrice.mockRejectedValue(new Error('only the store owner can approve sub-wholesale pricing'));

      await act(async () => {
        render(<StoreListingDetailPage params={{ store_id: storeId, listing_id: listingId }} />);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save & Update Retail Price/i })).toBeInTheDocument();
      });

      // Submit price update
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Save & Update Retail Price/i }));
      });

      await waitFor(() => {
        expect(screen.getByText(/only the store owner can approve sub-wholesale pricing/i)).toBeInTheDocument();
      });
    });
  });

  describe('Supplier Offers Page Atomic Import with Markup', () => {
    it('executes atomic import with markup parameters in a single API call', async () => {
      const offer = {
        offer_id: 'offer_789',
        offer_status: 'active',
        market_code: 'SA',
        product_id: 'prod_999',
        product_slug: 'smart-watch',
        product_name: 'Smart Fitness Watch',
        product_status: 'active',
        supplier_id: 'supp_111',
        supplier_code: 'TECH-SUPP',
        supplier_name: 'Tech Supplier Ltd',
        price: { amount_minor: 20000, currency: 'SAR' }, // 200 SAR
        fulfillment_count: 5,
        is_available: true,
        updated_at: new Date().toISOString(),
      };

      mockApi.listStoreSupplierOffers.mockResolvedValue({ items: [offer] });
      mockApi.importSupplierOffer.mockResolvedValue({
        id: 'new_listing_111',
        store_id: storeId,
        product_id: offer.product_id,
        supplier_offer_id: offer.offer_id,
        market_code: 'SA',
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await act(async () => {
        render(<StoreSupplierOffersPage params={{ store_id: storeId }} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Smart Fitness Watch')).toBeInTheDocument();
      });

      // Open import modal
      const importBtn = screen.getByRole('button', { name: /Import to Store Catalog/i });
      await act(async () => {
        fireEvent.click(importBtn);
      });

      expect(screen.getByText(/Configure Supplier Offer Import & Markup/i)).toBeInTheDocument();

      // Confirm import
      const confirmBtn = screen.getByRole('button', { name: /Confirm & Import to Store Catalog/i });
      await act(async () => {
        fireEvent.click(confirmBtn);
      });

      expect(mockApi.importSupplierOffer).toHaveBeenCalledWith(
        storeId,
        offer.offer_id,
        expect.objectContaining({
          markup_percentage: 20,
          retail_price_minor_units: 24000, // 200 + 20% = 240 SAR = 24000 minor
          shipping_subsidy_policy: 'buyer_paid',
        })
      );

      // Verify success notification
      await waitFor(() => {
        expect(screen.getByText(/Offer imported atomically with 20% markup/i)).toBeInTheDocument();
      });
    });
  });
});
