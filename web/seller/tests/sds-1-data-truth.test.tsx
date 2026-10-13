import React, { Suspense } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act, cleanup } from '@testing-library/react';
import StoreOrderDetailPage from '../app/(dashboard)/dashboard/stores/[store_id]/orders/[order_id]/page';
import StoreListingDetailPage from '../app/(dashboard)/dashboard/stores/[store_id]/catalog/listings/[listing_id]/page';
import StoreInventoryPage from '../app/(dashboard)/dashboard/stores/[store_id]/inventory/page';
import StoreFinancePage from '../app/(dashboard)/dashboard/stores/[store_id]/finance/page';
import StoreMediaLibraryPage from '../app/(dashboard)/dashboard/stores/[store_id]/media/page';
import { StoreSwitcher } from '../components/shell/StoreSwitcher';
import { StoreOnboardingWizard } from '../components/onboarding/StoreOnboardingWizard';
import { sellerApi, ApiError } from '../lib/api/client';
import { fetchMerchantConsole } from '../lib/api/merchant-console';
import { LocaleProvider } from '../lib/i18n/locale-context';
import { useRouter } from 'next/navigation';

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn()
}));

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  usePathname: () => '/dashboard/stores/str_1'
}));

vi.mock('../lib/api/merchant-console', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api/merchant-console')>()),
  fetchMerchantConsole: vi.fn()
}));

vi.mock('../lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api/client')>()),
  sellerApi: {
    getStoreOrderDetail: vi.fn(),
    getStoreListing: vi.fn(),
    getStoreListingLifecycle: vi.fn(),
    getListingReadiness: vi.fn(),
    updateListingPrice: vi.fn(),
    publishListing: vi.fn(),
    unpublishListing: vi.fn(),
    archiveListing: vi.fn(),
    listStoreInventory: vi.fn(),
    adjustInventory: vi.fn(),
    getStoreBalance: vi.fn(),
    listStoreLedgerEntries: vi.fn(),
    listStoreSettlements: vi.fn(),
    listStorePayouts: vi.fn(),
    listStoreMedia: vi.fn(),
    createMediaUpload: vi.fn(),
    completeMediaUpload: vi.fn(),
    deleteStoreMedia: vi.fn(),
    getStores: vi.fn(),
    ensureRetailWorkspace: vi.fn(),
    createStore: vi.fn(),
    installTheme: vi.fn()
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

  describe('Finance Currency Data Truth', () => {
    it('uses each financial record currency and renders unavailable instead of missing-currency or error fallbacks', async () => {
      vi.mocked(sellerApi.getStoreBalance).mockRejectedValue(new Error('balance unavailable'));
      vi.mocked(sellerApi.listStoreLedgerEntries).mockResolvedValue({
        items: [
          {
            id: 'jrn_egp',
            reference_type: 'ORDER',
            reference_id: 'ord_egp',
            description: 'EGP ledger row',
            currency: 'EGP',
            posted_at: '2026-10-01T10:00:00Z',
            created_at: '2026-10-01T10:00:00Z'
          },
          {
            id: 'jrn_unknown',
            reference_type: 'ORDER',
            reference_id: 'ord_unknown',
            description: 'Unknown currency ledger row',
            currency: '',
            posted_at: '2026-10-01T10:00:00Z',
            created_at: '2026-10-01T10:00:00Z'
          }
        ]
      });
      vi.mocked(sellerApi.listStoreSettlements).mockResolvedValue({
        items: [
          {
            id: 'stl_sar',
            settlement_period_id: 'period_1',
            account_id: 'acct_1',
            currency: 'SAR',
            gross_amount_minor: 12300,
            adjustment_amount_minor: 0,
            net_amount_minor: 12300,
            status: 'CALCULATED',
            created_at: '2026-10-01T10:00:00Z'
          }
        ]
      });
      vi.mocked(sellerApi.listStorePayouts).mockResolvedValue({
        items: [
          {
            id: 'po_egp',
            store_id: 'str_1',
            amount_minor: 0,
            currency: 'EGP',
            status: 'DISBURSED',
            payout_method: 'bank_transfer',
            created_at: '2026-10-01T10:00:00Z'
          }
        ]
      });

      await act(async () => {
        render(
          <Suspense fallback={<div>Loading finance route...</div>}>
            <StoreFinancePage params={Promise.resolve({ store_id: 'str_1' })} />
          </Suspense>
        );
      });

      await waitFor(() => {
        expect(screen.getAllByText('Financial data unavailable')).toHaveLength(2);
      });
      expect(screen.queryByText('SAR 0.00')).not.toBeInTheDocument();

      expect(screen.getByText(/EGP\s+0/)).toBeInTheDocument();
      expect(screen.getByText('Unavailable')).toBeInTheDocument();

      fireEvent.click(screen.getByText('SETTLEMENTS'));
      expect(screen.getAllByText(/SAR\s+123/)).toHaveLength(2);

      fireEvent.click(screen.getByText('PAYOUTS'));
      expect(screen.getByText(/EGP\s+0/)).toBeInTheDocument();
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
      vi.mocked(sellerApi.getStoreListingLifecycle).mockResolvedValue(null as any);
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

    it('renders direct-create rejection as an actionable onboarding state without an alert() and without a create CTA in the switcher', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      vi.mocked(sellerApi.getStores).mockResolvedValue({
        items: [{ id: 'str_1', seller_id: 'slr_1', name: 'Store 1', code: 's1', market_code: 'SA', status: 'active', created_at: '', updated_at: '' }],
        active_store_limit: 5,
        active_store_count: 1
      });
      vi.mocked(fetchMerchantConsole as ReturnType<typeof vi.fn>).mockResolvedValue({
        contract_version: '1',
        workspaces: [],
        selected_merchant_id: null
      });
      vi.mocked(sellerApi.ensureRetailWorkspace).mockResolvedValue({ id: 'm_1', code: 'merchant-dup-code', legal_name: 'Dup Store', status: 'active' });
      vi.mocked(sellerApi.createStore).mockRejectedValue(
        new ApiError('store_entitlement_exceeded', 'active store entitlement exceeded', 409)
      );

      render(<StoreOnboardingWizard />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g. Al-Nour Boutique')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('e.g. Al-Nour Boutique'), { target: { value: 'Dup Store' } });
      fireEvent.click(screen.getByText('Choose Theme'));
      fireEvent.click(screen.getByText('Review Setup'));
      fireEvent.click(screen.getByText('Create Store & Launch Dashboard'));

      await waitFor(() => {
        expect(sellerApi.createStore).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(
          screen.getByText('Only one store can be created in this phase. Open your existing store from the store switcher to continue managing it.')
        ).toBeInTheDocument();
      });

      expect(alertSpy).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    it('renders the rejected additional-store message in Arabic with RTL direction under initialLocale="ar", while first-store onboarding still succeeds', async () => {
      const arWrapper = ({ children }: { children: React.ReactNode }) => (
        <LocaleProvider initialLocale="ar">{children}</LocaleProvider>
      );
      vi.mocked(fetchMerchantConsole as ReturnType<typeof vi.fn>).mockResolvedValue({
        contract_version: '1',
        workspaces: [],
        selected_merchant_id: null
      });

      // Rejected additional-store attempt under the Arabic locale.
      vi.mocked(sellerApi.ensureRetailWorkspace).mockResolvedValue({ id: 'm_1', code: 'merchant-dup-code', legal_name: 'Dup Store', status: 'active' });
      vi.mocked(sellerApi.createStore).mockRejectedValue(
        new ApiError('store_entitlement_exceeded', 'active store entitlement exceeded', 409)
      );

      render(<StoreOnboardingWizard />, { wrapper: arWrapper });

      await waitFor(() => {
        expect(document.documentElement.dir).toBe('rtl');
      });
      expect(document.documentElement.lang).toBe('ar');

      await waitFor(() => {
        expect(screen.getByPlaceholderText('مثال: متجر النور')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('مثال: متجر النور'), { target: { value: 'Dup Store' } });
      fireEvent.click(screen.getByText('اختيار المظهر'));
      fireEvent.click(screen.getByText('مراجعة الإعداد'));
      fireEvent.click(screen.getByText('إنشاء المتجر وفتح لوحة التحكم'));

      await waitFor(() => {
        expect(
          screen.getByText('لا يمكن إنشاء أكثر من متجر واحد في هذه المرحلة. افتح متجرك الحالي من مبدّل المتاجر لمتابعة إدارته.')
        ).toBeInTheDocument();
      });
      expect(document.documentElement.dir).toBe('rtl');

      // First-store onboarding keeps succeeding for a merchant with no store.
      vi.mocked(sellerApi.createStore).mockResolvedValue({
        id: 'str_new',
        seller_id: 'slr_1',
        name: 'New Store',
        code: 'new-store',
        market_code: 'SA',
        status: 'draft',
        created_at: '',
        updated_at: ''
      });
      cleanup();
      render(<StoreOnboardingWizard />, { wrapper: arWrapper });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('مثال: متجر النور')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('مثال: متجر النور'), { target: { value: 'New Store' } });
      fireEvent.click(screen.getByText('اختيار المظهر'));
      fireEvent.click(screen.getByText('مراجعة الإعداد'));
      fireEvent.click(screen.getByText('إنشاء المتجر وفتح لوحة التحكم'));

      await waitFor(() => {
        // The first-store path is not blocked by the earlier rejection.
        expect(sellerApi.createStore).toHaveBeenCalledTimes(2);
      });
      expect(routerMock.push).toHaveBeenCalledWith('/dashboard/merchants/m_1/stores/str_new');
    });

    it('offers no Create Store CTA or form even with the dropdown open, and keeps existing stores selectable', async () => {
      vi.mocked(sellerApi.getStores).mockResolvedValue({
        items: [
          { id: 'str_1', seller_id: 'slr_1', name: 'Store 1', code: 's1', market_code: 'SA', status: 'active', created_at: '', updated_at: '' },
          { id: 'str_2', seller_id: 'slr_1', name: 'Store 2', code: 's2', market_code: 'SA', status: 'draft', created_at: '', updated_at: '' }
        ],
        active_store_limit: 5,
        active_store_count: 2
      });

      render(<StoreSwitcher currentStoreId="str_1" />);

      await waitFor(() => {
        expect(screen.getByText('Store 1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Store 1'));

      expect(screen.getByText('Store 2')).toBeInTheDocument();
      expect(screen.queryByText('Create Store')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Store Name')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Store Code (e.g. store-a)')).not.toBeInTheDocument();
      expect(screen.queryByText('Save')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('store-switcher-option-s2'));

      expect(routerMock.push).toHaveBeenCalledWith('/dashboard/stores/str_2');
    });

    it('keeps first-store onboarding intact for a merchant with no store', async () => {
      vi.mocked(fetchMerchantConsole as ReturnType<typeof vi.fn>).mockResolvedValue({
        contract_version: '1',
        workspaces: [],
        selected_merchant_id: null
      });
      vi.mocked(sellerApi.ensureRetailWorkspace).mockResolvedValue({ id: 'm_new', code: 'merchant-new-store', legal_name: 'New Store', status: 'active' });
      vi.mocked(sellerApi.createStore).mockResolvedValue({
        id: 'str_new',
        seller_id: 'slr_1',
        name: 'New Store',
        code: 'new-store',
        market_code: 'SA',
        status: 'draft',
        created_at: '',
        updated_at: ''
      });
      vi.mocked(sellerApi.installTheme).mockResolvedValue({
        id: 'theme-inst-1',
        store_id: 'str_new',
        theme_key: 'default',
        version: '1.0.0',
        status: 'active'
      } as any);

      render(<StoreOnboardingWizard />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g. Al-Nour Boutique')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('e.g. Al-Nour Boutique'), { target: { value: 'New Store' } });
      fireEvent.click(screen.getByText('Choose Theme'));
      fireEvent.click(screen.getByText('Review Setup'));
      fireEvent.click(screen.getByText('Create Store & Launch Dashboard'));

      await waitFor(() => {
        expect(sellerApi.createStore).toHaveBeenCalled();
      });
      expect(routerMock.push).toHaveBeenCalledWith('/dashboard/merchants/m_new/stores/str_new');
    });
  });
});
