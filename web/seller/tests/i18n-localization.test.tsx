import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { LocaleProvider, useTranslation } from '@/lib/i18n/locale-context';
import { Header } from '@/components/seller/Header';
import { getNavigationForStore, getNavigationForMerchantWorkspace } from '@/config/seller-navigation';

const navigationMock = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn()
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: navigationMock.push,
    replace: navigationMock.replace,
    refresh: vi.fn()
  }),
  usePathname: () => '/dashboard/stores/store_123',
  useParams: () => ({ store_id: 'store_123' }),
  useSearchParams: () => new URLSearchParams()
}));

vi.mock('@/lib/api/merchant-console', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/merchant-console')>('@/lib/api/merchant-console');
  return {
    ...actual,
    fetchMerchantConsole: vi.fn(() =>
      Promise.resolve({
        contract_version: 'test',
        workspaces: [
          {
            merchant_id: 'merchant_123',
            merchant_code: 'MRC-123',
            legal_name: 'Tap Banana Trading Co.',
            merchant_status: 'active',
            membership: { id: 'msh_1', status: 'active', permissions: ['merchant.manage'] },
            capabilities: { retail: { status: 'active' }, supply: { status: 'active' } },
            stores: [{ id: 'store_123', code: 'ST-1', name: 'Riyadh Front', status: 'ACTIVE', market_code: 'SA' }],
            plan_summary: { state: 'UNAVAILABLE' },
            pending_actions: { open_review_cases: 2, unhealthy_connections: 1 }
          }
        ]
      })
    )
  };
});

import MerchantWorkspacePage from '@/app/(dashboard)/dashboard/merchants/[merchant_id]/page';
import StoreFinancePage from '@/app/(dashboard)/dashboard/stores/[store_id]/finance/page';
import StoreCategoriesPage from '@/app/(dashboard)/dashboard/stores/[store_id]/catalog/categories/page';
import StoreListingsPage from '@/app/(dashboard)/dashboard/stores/[store_id]/catalog/listings/page';
import StoreListingDetailPage from '@/app/(dashboard)/dashboard/stores/[store_id]/catalog/listings/[listing_id]/page';
import StoreIntegrationsPage from '@/app/(dashboard)/dashboard/stores/[store_id]/integrations/page';
import StoreMediaLibraryPage from '@/app/(dashboard)/dashboard/stores/[store_id]/media/page';
import StoreOrdersPage from '@/app/(dashboard)/dashboard/stores/[store_id]/orders/page';
import StoreInventoryPage from '@/app/(dashboard)/dashboard/stores/[store_id]/inventory/page';
import StoreOverviewPage from '@/app/(dashboard)/dashboard/stores/[store_id]/page';
import StoreProductsPage from '@/app/(dashboard)/dashboard/stores/[store_id]/catalog/products/page';
import StoreSupplierOffersPage from '@/app/(dashboard)/dashboard/stores/[store_id]/catalog/supplier-offers/page';
import NewStoreProductPage from '@/app/(dashboard)/dashboard/stores/[store_id]/catalog/products/new/page';
import StoreProductDetailPage from '@/app/(dashboard)/dashboard/stores/[store_id]/catalog/products/[product_id]/page';
import StorefrontSettingsPage from '@/app/(dashboard)/dashboard/stores/[store_id]/storefront/page';
import { ShipmentsOverviewScreen } from '@/components/seller/ShipmentsOverviewScreen';
import { OrderDetailScreen } from '@/components/seller/OrderDetailScreen';
import { CreateShipmentModal } from '@/components/seller/CreateShipmentModal';
import { SupplyError } from '@/components/supply/supply-state';
import StoreSegmentError from '@/app/(dashboard)/dashboard/stores/[store_id]/error';

const sellerApiMock = vi.hoisted(() => ({
  getStoreBalance: vi.fn(),
  listStoreLedgerEntries: vi.fn(),
  listStoreSettlements: vi.fn(),
  listStorePayouts: vi.fn(),
  listStoreConnections: vi.fn(),
  listStoreEntityMappings: vi.fn(),
  listStoreSyncJobs: vi.fn(),
  listStoreAPIKeys: vi.fn(),
  listStoreWebhookSubscriptions: vi.fn(),
  listStoreMedia: vi.fn(),
  listStoreOrders: vi.fn(),
  getStoreOrderDetail: vi.fn(),
  listStoreShipments: vi.fn(),
  createStoreShipment: vi.fn(),
  getStores: vi.fn(),
  listStoreProducts: vi.fn(),
  getStoreProductDetail: vi.fn(),
  listProductMediaReferences: vi.fn(),
  listStoreListings: vi.fn(),
  getStoreListing: vi.fn(),
  getStoreListingLifecycle: vi.fn(),
  getListingReadiness: vi.fn(),
  listStoreCategories: vi.fn(),
  listStoreInventory: vi.fn(),
  listStoreLocations: vi.fn(),
  getStorefrontHost: vi.fn(),
  listThemes: vi.fn(),
  getThemeInstallation: vi.fn(),
  getStoreOperationalState: vi.fn(),
  listStoreSupplierOffers: vi.fn(),
  importSupplierOffer: vi.fn()
}));

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  sellerApi: sellerApiMock
}));

describe('Arabic Localization & RTL Switching (US5)', () => {
  beforeEach(() => {
    // Reset document attributes and cookie
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
    document.cookie = 'mh_locale=; max-age=0; path=/';
  });

  it('initializes with English locale and resolves English dictionary terms', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider initialLocale="en">{children}</LocaleProvider>
    );
    const { result } = renderHook(() => useTranslation(), { wrapper });

    expect(result.current.locale).toBe('en');
    expect(result.current.direction).toBe('ltr');
    expect(result.current.isRtl).toBe(false);
    expect(result.current.t('common.save')).toBe('Save');
    expect(result.current.t('nav.inventory')).toBe('Inventory');
    expect(result.current.t('catalog.unsafeMarginWarning')).toBe('Unsafe Margin Warning');
    expect(result.current.t('nonexistent.key', 'Fallback')).toBe('Fallback');
  });

  it('switches to Arabic locale, sets RTL direction, and stores mh_locale cookie', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider initialLocale="en">{children}</LocaleProvider>
    );
    const { result } = renderHook(() => useTranslation(), { wrapper });

    act(() => {
      result.current.setLocale('ar');
    });

    expect(result.current.locale).toBe('ar');
    expect(result.current.direction).toBe('rtl');
    expect(result.current.isRtl).toBe(true);
    expect(result.current.t('common.save')).toBe('حفظ');
    expect(result.current.t('nav.inventory')).toBe('المخزون');
    expect(result.current.t('catalog.unsafeMarginWarning')).toBe('تحذير: هامش ربح غير آمن');

    // DOM document verification
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.cookie).toContain('mh_locale=ar');
  });

  it('reads mh_locale cookie on initialization', () => {
    document.cookie = 'mh_locale=ar; path=/';
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider>{children}</LocaleProvider>
    );
    const { result } = renderHook(() => useTranslation(), { wrapper });

    expect(result.current.locale).toBe('ar');
    expect(result.current.direction).toBe('rtl');
    expect(result.current.isRtl).toBe(true);
    expect(result.current.t('common.create')).toBe('إنشاء');
  });

  it('toggles language between English and Arabic via Header language switch button', () => {
    render(
      <LocaleProvider initialLocale="en">
        <Header title="Store Operations" subtitle="Fulfillment and catalog" />
      </LocaleProvider>
    );

    // Initial state: English with button inviting to switch to Arabic
    const toggleButton = screen.getByRole('button', { name: /Switch to Arabic layout/i });
    expect(toggleButton).toHaveTextContent('العربية');
    expect(document.documentElement.dir).toBe('ltr');

    // Click to switch to Arabic
    fireEvent.click(toggleButton);

    // Button should now indicate English to switch back, and document is RTL
    expect(screen.getByRole('button', { name: /Switch to English layout/i })).toHaveTextContent('English');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.cookie).toContain('mh_locale=ar');

    // Click again to switch back to English
    fireEvent.click(screen.getByRole('button', { name: /Switch to English layout/i }));

    expect(screen.getByRole('button', { name: /Switch to Arabic layout/i })).toHaveTextContent('العربية');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
    expect(document.cookie).toContain('mh_locale=en');
  });

  it('falls back to the matching English fixed string for a missing Arabic translation', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider initialLocale="ar">{children}</LocaleProvider>
    );
    const { result } = renderHook(() => useTranslation(), { wrapper });

    const fixedText = result.current.t('dashboard.missingFixedStringForFallback', 'English fallback sentinel');

    expect(fixedText).toBe('English fallback sentinel');
    expect(fixedText).not.toBe('dashboard.missingFixedStringForFallback');
    expect(fixedText.trim()).not.toBe('');
    expect(fixedText.toLowerCase()).not.toContain('todo');
  });

  it('renders server-provided messages using available localized text without replacing identifiers', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider initialLocale="ar">{children}</LocaleProvider>
    );
    const { result } = renderHook(() => useTranslation(), { wrapper });

    expect(result.current.serverMessage({ message_en: 'Store SKU ABC-123 is unavailable.' })).toBe('Store SKU ABC-123 is unavailable.');
    expect(
      result.current.serverMessage({
        message: 'Fallback message for ERR-42',
        message_ar: 'المتجر SKU ABC-123 غير متاح.'
      })
    ).toBe('المتجر SKU ABC-123 غير متاح.');
  });

  it('provides Arabic and English labels for dashboard shell navigation and statuses', () => {
    const storeNav = getNavigationForStore('store_123');
    const workspaceNav = getNavigationForMerchantWorkspace({
      merchantId: 'merchant_123',
      storeId: 'store_123',
      capabilities: { retail: 'active', supply: 'active' },
      permissions: ['merchant.manage']
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider initialLocale="ar">{children}</LocaleProvider>
    );
    const { result } = renderHook(() => useTranslation(), { wrapper });

    expect(storeNav.map((item) => result.current.t(item.labelKey || '', item.label))).toContain('الكتالوج');
    expect(workspaceNav.map((item) => result.current.t(item.labelKey || '', item.label))).toContain('التوريد');
    expect(result.current.t('statuses.active')).toBe('نشط');
    expect(result.current.t('dashboardOverview.openWorkspace')).toBe('فتح مساحة العمل');
  });

  it('renders the merchant workspace overview in Arabic with RTL document direction', async () => {
    // The page consumes `use(params)`, which suspends; render is awaited inside act
    // (same pattern as tests/merchant-console.test.tsx).
    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <LocaleProvider initialLocale="ar">
          <MerchantWorkspacePage params={Promise.resolve({ merchant_id: 'merchant_123' })} />
        </LocaleProvider>
      );
    });
    void utils;

    await waitFor(() => {
      expect(screen.getByTestId('merchant-workspace-overview')).toBeInTheDocument();
    });

    // Fixed UI copy is localized; external/user data (IDs, status enums, numbers, and the
    // merchant legal name resolved from the API) is preserved untouched.
    expect(screen.getByText('قدرة التجزئة')).toBeInTheDocument();
    expect(screen.getByText('قدرة التوريد')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /فتح وحدة التوريد/ })).toHaveAttribute(
      'href',
      '/dashboard/merchants/merchant_123/supply/connections'
    );
    expect(screen.getByText('حالات مراجعة مفتوحة')).toBeInTheDocument();
    expect(screen.getByText('اتصالات غير سليمة')).toBeInTheDocument();
    expect(screen.getByText('المتاجر المصرح بها')).toBeInTheDocument();
    // External/user data (legal name, merchant code, store code/market/status enums) is preserved untouched.
    const overview = screen.getByTestId('merchant-workspace-overview');
    expect(overview.textContent).toContain('Tap Banana Trading Co.');
    expect(overview.textContent).toContain('MRC-123');
    expect(overview.textContent).toContain('ST-1');
    expect(overview.textContent).toContain('SA');
    expect(overview.textContent).toContain('ACTIVE');

    // RTL is applied to the document for the Arabic merchant/Supply route.
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('renders the shared Supply error state in Arabic under RTL', () => {
    render(
      <LocaleProvider initialLocale="ar">
        <SupplyError />
      </LocaleProvider>
    );

    expect(screen.getByTestId('supply-error')).toHaveTextContent('حدث خطأ ما');
    expect(screen.getByTestId('supply-error')).toHaveTextContent('تعذر تحميل البيانات. حاول مرة أخرى بعد قليل.');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('renders the store finance page in Arabic under the RTL document direction', async () => {
    sellerApiMock.getStoreBalance.mockResolvedValue({
      available_minor: 12500,
      pending_minor: 3000,
      currency: 'SAR'
    });
    sellerApiMock.listStoreLedgerEntries.mockResolvedValue({
      items: [
        {
          id: 'jrn_ar_1',
          reference_type: 'ORDER',
          reference_id: 'ord_ar_1',
          description: 'Arabic ledger row',
          currency: 'SAR',
          posted_at: '2026-10-01T10:00:00Z',
          created_at: '2026-10-01T10:00:00Z'
        }
      ]
    });
    sellerApiMock.listStoreSettlements.mockResolvedValue({ items: [] });
    sellerApiMock.listStorePayouts.mockResolvedValue({ items: [] });

    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <LocaleProvider initialLocale="ar">
          <StoreFinancePage params={Promise.resolve({ store_id: 'store_123' })} />
        </LocaleProvider>
      );
    });
    void utils;

    await waitFor(() => {
      expect(screen.getByText('دفتر الحسابات المالية وعمليات التسوية')).toBeInTheDocument();
    });

    // Fixed UI copy is localized in Arabic while financial record data stays untouched.
    expect(screen.getByText('الرصيد المتاح')).toBeInTheDocument();
    expect(screen.getByText('نظرة عامة')).toBeInTheDocument();
    expect(screen.getByText('أحدث حركات دفتر القيود المزدوج')).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');

    // Preserved financial record values and IDs (untouched by localization).
    const page = screen.getByText('دفتر الحسابات المالية وعمليات التسوية').closest('div.max-w-5xl')!;
    expect(page.textContent).toContain('SAR\u00a00');
    expect(page.textContent).toContain('SAR\u00a0125');
    expect(page.textContent).toContain('SAR\u00a030');
    expect(page.textContent).toContain('Arabic ledger row');
    expect(page.textContent).toContain('ord_ar_1');
  });

  it('renders the store integrations page in Arabic under the RTL document direction', async () => {
    sellerApiMock.listStoreConnections.mockResolvedValue({
      items: [
        { id: 'conn_ar_1', provider: 'salla', name: 'Salla Main Sync', status: 'active' }
      ]
    });
    sellerApiMock.listStoreSyncJobs.mockResolvedValue({ items: [] });
    sellerApiMock.listStoreAPIKeys.mockResolvedValue({
      items: [
        {
          id: 'key_ar_1',
          name: 'ERP Inventory Sync',
          key_prefix: 'sk_live_ab',
          scopes: ['products:read'],
          status: 'active',
          created_at: '2026-10-01T10:00:00Z'
        }
      ]
    });
    sellerApiMock.listStoreWebhookSubscriptions.mockResolvedValue({ items: [] });
    sellerApiMock.listStoreEntityMappings.mockResolvedValue({ items: [] });

    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <LocaleProvider initialLocale="ar">
          <StoreIntegrationsPage params={Promise.resolve({ store_id: 'store_123' })} />
        </LocaleProvider>
      );
    });
    void utils;

    await waitFor(() => {
      expect(screen.getByText('أساس التكامل الخارجي ووحدة تحكم المطوّرين')).toBeInTheDocument();
    });

    // Fixed UI copy is localized in Arabic (tabs, table headers, actions).
    expect(screen.getByRole('button', { name: 'مفاتيح API' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'الاتصالات' })).toBeInTheDocument();
    expect(screen.getByText('مفاتيح API للمطوّر الخاصة بالمتجر')).toBeInTheDocument();
    expect(screen.getByText('تحديث المفاتيح')).toBeInTheDocument();
    expect(screen.getByText('الاسم')).toBeInTheDocument();
    expect(screen.getByText('الإجراءات')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إبطال' })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');

    // External provider/entity/identifier data is preserved untouched.
    const page = screen.getByText('أساس التكامل الخارجي ووحدة تحكم المطوّرين').closest('div.max-w-5xl')!;
    expect(page.textContent).toContain('ERP Inventory Sync');
    expect(page.textContent).toContain('sk_live_ab...');
    expect(page.textContent).toContain('products:read');

    // Switching to the Connections tab renders provider data untouched in Arabic.
    fireEvent.click(screen.getByRole('button', { name: 'الاتصالات' }));
    expect(await screen.findByText('Salla Main Sync')).toBeInTheDocument();
    expect(page.textContent).toContain('conn_ar_1');
    expect(page.textContent).toContain('المزود:');
    expect(page.textContent).toContain('ACTIVE');
  });

  it('renders the store media library page in Arabic under the RTL document direction', async () => {
    sellerApiMock.listStoreMedia.mockResolvedValue({
      items: [
        {
          id: 'md_ar_1',
          original_filename: 'banner-ar.png',
          url: 'https://cdn.example.com/media/banner-ar.png',
          checksum_sha256: 'sha256med1a2b3c',
          content_type: 'image/png',
          byte_size: 20480,
          status: 'READY'
        }
      ]
    });

    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <LocaleProvider initialLocale="ar">
          <StoreMediaLibraryPage params={Promise.resolve({ store_id: 'store_123' })} />
        </LocaleProvider>
      );
    });
    void utils;

    await waitFor(() => {
      expect(screen.getByText('مكتبة وسائط المتجر')).toBeInTheDocument();
    });

    // Fixed UI copy is localized in Arabic.
    expect(screen.getByText('رفع وسائط')).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');

    // Preserved media file data (filename, presigned URL on the img element,
    // checksum, size) and the localized delete confirmation copy under RTL.
    const page = screen.getByText('مكتبة وسائط المتجر').closest('div.space-y-6')!;
    expect(page.textContent).toContain('banner-ar.png');
    expect(page.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example.com/media/banner-ar.png');
    expect(page.textContent).toContain('sha256med1a2b3c');
    expect(page.textContent).toContain('READY');
    expect(page.textContent).toContain('20.0');
    expect(page.textContent).toContain('ك.ب');
    fireEvent.click(screen.getByTitle('حذف الأصل بأمان'));
    expect(await screen.findByText('حذف أصل وسائط')).toBeInTheDocument();
    expect(screen.getByText('الاحتفاظ بالأصل')).toBeInTheDocument();
  });

  it('renders the store orders queue in Arabic under the RTL document direction', async () => {
    sellerApiMock.listStoreOrders.mockResolvedValue({
      orders: [
        {
          id: 'ord_ar_1',
          order_number: 'ORD-2026-AR01',
          status: 'confirmed',
          currency: 'SAR',
          total: 25000,
          item_count: 2,
          recipient_name: 'سارة العتيبي',
          created_at: '2026-10-01T10:00:00Z'
        },
        {
          id: 'ord_ar_2',
          order_number: 'ORD-2026-AR02',
          status: 'shipped',
          currency: 'SAR',
          total: 8900,
          item_count: 1,
          created_at: '2026-10-02T10:00:00Z'
        }
      ],
      total: 2,
      limit: 20,
      offset: 0
    });

    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <LocaleProvider initialLocale="ar">
          <StoreOrdersPage params={{ store_id: 'store_123' }} />
        </LocaleProvider>
      );
    });
    void utils;

    await waitFor(() => {
      expect(screen.getByText('إدارة الطلبات')).toBeInTheDocument();
    });

    // Fixed UI copy is localized in Arabic (filter tabs, search, table headers, empty/loading states).
    expect(screen.getByRole('button', { name: 'جميع الطلبات' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'مؤكد' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تم الشحن' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ابحث حسب رقم الطلب أو المستلم...')).toBeInTheDocument();
    expect(screen.getByText('رقم الطلب')).toBeInTheDocument();
    expect(screen.getByText('العميل')).toBeInTheDocument();
    expect(screen.getByText('الإجراء')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /إدارة/ })[0].getAttribute('href')).toBe(
      '/dashboard/stores/store_123/orders/ord_ar_1'
    );
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');

    // User data (recipient name, order numbers, prices) is preserved untouched; missing
    // recipient falls back to the localizedGuestCustomer label.
    const page = screen.getByText('إدارة الطلبات').closest('div.space-y-6')!;
    expect(page.textContent).toContain('سارة العتيبي');
    expect(page.textContent).toContain('ORD-2026-AR01');
    expect(page.textContent).toContain('250.00 SAR');
    expect(page.textContent).toContain('عميل زائر');
    expect(page.textContent).toContain('ORD-2026-AR02');
  });

  it('renders the order detail screen in Arabic under RTL while preserving identifiers and statuses', async () => {
    sellerApiMock.getStoreOrderDetail.mockResolvedValue({
      id: 'ord_ar_detail',
      order_number: 'ORD-2026-AR09',
      status: 'confirmed',
      currency: 'SAR',
      subtotal: 20000,
      total: 25000,
      created_at: '2026-10-01T10:00:00Z',
      contact_email: 'buyer@example.com',
      items: [
        {
          id: 'oit_ar_1',
          product_name: 'منتج تجريبي',
          sku_code: 'SKU-AR-1',
          source: 'RETAIL',
          quantity: 2,
          unit_price: 10000,
          total_price: 20000
        }
      ],
      shipping_address: {
        recipient_name: 'سارة العتيبي',
        address_line_1: 'شارع التحلية 12',
        city: 'الرياض',
        country_code: 'SA',
        phone: '+966500000000'
      },
      timeline: [{ id: 'tl_ar_1', type: 'created', detail: 'Created via store API', created_at: '2026-10-01T10:05:00Z' }]
    });

    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <LocaleProvider initialLocale="ar">
          <OrderDetailScreen storeId="store_123" orderId="ord_ar_detail" />
        </LocaleProvider>
      );
    });
    void utils;

    await waitFor(() => {
      expect(screen.getByText(/تنفيذ الطلبات وتتبعها/)).toBeInTheDocument();
    });

    // Fixed UI copy localized in Arabic while the raw status/enum remains untouched.
    await waitFor(() => {
      expect(screen.getByText('الرجوع إلى الطلبات')).toBeInTheDocument();
    });
    expect(screen.getByText('مؤكد')).toBeInTheDocument();
    expect(screen.getByText('بدء التنفيذ')).toBeInTheDocument();
    expect(screen.getByText('إلغاء الطلب')).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');

    // Order/IDs, tracking-style data, and server data are preserved untouched.
    await waitFor(() => {
      expect(screen.getByText(/تنفيذ الطلبات وتتبعها/)).toBeInTheDocument();
    });
    const page = screen.getByText(/تنفيذ الطلبات وتتبعها/).closest('div.max-w-4xl')!;
    expect(page.textContent).toContain('ord_ar_detail');
    expect(page.textContent).toContain('ORD-2026-AR09');
    expect(page.textContent).toContain('SKU-AR-1');
    expect(page.textContent).toContain('buyer@example.com');
    expect(page.textContent).toContain('الرياض');
  });

  it('renders the shipments queue in Arabic under RTL while preserving shipment status enums', async () => {
    sellerApiMock.listStoreShipments.mockResolvedValue({
      items: [
        {
          id: 'shp_ar_1',
          order_id: 'ord_ar_1',
          fulfillment_location_id: 'loc_main',
          status: 'PENDING',
          carrier_name: 'SMSA Express',
          tracking_number: 'SMSA-998877',
          shipping_cost_minor: 2500,
          cod_amount_minor: 0,
          currency: 'SAR',
          items: [{ id: 'item_1', shipment_id: 'shp_ar_1', order_item_id: 'oit_1', quantity: 2, created_at: '2026-10-01' }],
          created_at: '2026-10-01T10:00:00Z'
        }
      ],
      total_count: 1,
      page: 1,
      page_size: 50
    });

    render(
      <LocaleProvider initialLocale="ar">
        <ShipmentsOverviewScreen storeId="store_123" />
      </LocaleProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('قائمة شحنات المتجر')).toBeInTheDocument();
    });

    expect(screen.getByText('إنشاء شحنة')).toBeInTheDocument();
    // Shipment status enums are preserved (raw, not translated) on filter buttons.
    expect(screen.getByRole('button', { name: 'PENDING' })).toBeInTheDocument();
    expect(screen.getByText('رمز التتبع')).toBeInTheDocument();
    expect(screen.getByText('تكلفة الشحن')).toBeInTheDocument();
    expect(screen.getByText('عرض الطلب')).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');

    // Shipment identifiers and tracking numbers are preserved untouched.
    expect(screen.getByText('SMSA-998877')).toBeInTheDocument();
    expect(screen.getByText('ord_ar_1')).toBeInTheDocument();
    expect(document.querySelector('[aria-label="مرشحات حالة الشحنات"]')).not.toBeNull();
  });

  it('renders the shipment creation modal and its Arabic success message under RTL', async () => {
    sellerApiMock.listStoreShipments.mockResolvedValue({ items: [], total_count: 0, page: 1, page_size: 50 });
    sellerApiMock.createStoreShipment.mockResolvedValue({
      id: 'shp_ar_new',
      order_id: 'ord_ar_1',
      fulfillment_location_id: 'loc_main',
      status: 'PENDING',
      tracking_number: 'TRK-ord_ar_1-auto01',
      shipping_cost_minor: 1500,
      currency: 'SAR',
      items: [],
      created_at: '2026-10-06T12:00:00Z'
    });

    render(
      <LocaleProvider initialLocale="ar">
        <ShipmentsOverviewScreen storeId="store_123" />
      </LocaleProvider>
    );

    fireEvent.click((await screen.findAllByRole('button', { name: 'إنشاء شحنة' }))[0]);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('مثال: ord_01j7...')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/معرّف الطلب/), { target: { value: 'ord_ar_1' } });
    fireEvent.change(screen.getByLabelText(/معرّف عنصر الطلب 1/), { target: { value: 'oit_1' } });
    fireEvent.click(screen.getByRole('dialog').querySelector('button[type="submit"]')!);

    await waitFor(() => {
      expect(screen.getByText('تم إنشاء الشحنة بنجاح برمز التتبع TRK-ord_ar_1-auto01.')).toBeInTheDocument();
    });
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('keeps the CreateShipmentModal validation copy localized in Arabic outside the queue screen', () => {
    render(
      <LocaleProvider initialLocale="ar">
        <CreateShipmentModal isOpen onClose={vi.fn()} onSubmit={vi.fn()} />
      </LocaleProvider>
    );

    expect(screen.getByText('إنشاء شحنة متجر')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('مثال: ord_01j7...')).toBeInTheDocument();
    expect(screen.getByLabelText(/معرّف الطلب/)).toBeInTheDocument();
    expect(screen.getByLabelText(/موقع التنفيذ/)).toBeInTheDocument();
    expect(screen.getByText('عناصر الشحنة')).toBeInTheDocument();
  });

  it('renders the storefront settings route in Arabic under the RTL document direction', async () => {
    sellerApiMock.getStores.mockResolvedValue({ items: [{ id: 'store_123', code: 'ST-1', name: 'Riyadh Front' }] });
    sellerApiMock.listThemes.mockResolvedValue({ items: [] });
    sellerApiMock.getThemeInstallation.mockResolvedValue(null);
    sellerApiMock.getStoreOperationalState.mockResolvedValue({ checkout_accepting: true, maintenance_message: '' });
    sellerApiMock.getStorefrontHost.mockResolvedValue({ host: 'ST-1.localhost:3000' });

    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <LocaleProvider initialLocale="ar">
          <StorefrontSettingsPage params={Promise.resolve({ store_id: 'store_123' })} />
        </LocaleProvider>
      );
    });
    void utils;

    await waitFor(() => {
      expect(screen.getByText('إعدادات واجهة المتجر المرجعية')).toBeInTheDocument();
    });

    // Fixed UI copy localized in Arabic, with the resolved host URL preserved untouched.
    expect(screen.getByText('النطاق المرجعي لواجهة المتجر')).toBeInTheDocument();
    expect(screen.getByText('تم الحل عبر مُحلل النطاقات في Core:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /فتح واجهة متجر العملاء المرجعية/ })).toHaveAttribute(
      'href',
      'http://ST-1.localhost:3000'
    );
    expect(screen.getByText('حل النطاقات الذري مُفعّل')).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('renders the default checkout maintenance message and localized loading/empty states in Arabic', async () => {
    sellerApiMock.getStores.mockResolvedValue({ items: [] });
    sellerApiMock.listThemes.mockResolvedValue({ items: [] });
    sellerApiMock.getThemeInstallation.mockResolvedValue(null);
    sellerApiMock.getStoreOperationalState.mockResolvedValue(null);
    sellerApiMock.listStoreOrders.mockResolvedValue({ orders: [], total: 0, limit: 20, offset: 0 });

    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <LocaleProvider initialLocale="ar">
          <StorefrontSettingsPage params={Promise.resolve({ store_id: 'store_123' })} />
        </LocaleProvider>
      );
    });
    void utils;
    await waitFor(() => {
      expect(screen.getByText('إعدادات واجهة المتجر المرجعية')).toBeInTheDocument();
    });

    // The default customer-facing maintenance message renders in Arabic.
    expect(document.body.textContent).toContain('الدفع غير متاح مؤقتاً. يرجى المحاولة مرة أخرى لاحقاً.');

    // Empty orders state localized in Arabic under RTL.
    utils.unmount();
    let ordersUtils!: ReturnType<typeof render>;
    await act(async () => {
      ordersUtils = render(
        <LocaleProvider initialLocale="ar">
          <StoreOrdersPage params={{ store_id: 'store_123' }} />
        </LocaleProvider>
      );
    });
    void ordersUtils;
    await waitFor(() => {
      expect(screen.getByText('لا توجد طلبات')).toBeInTheDocument();
      expect(screen.getByText('لم يتم تقديم أي طلبات من العملاء في هذا المتجر بعد.')).toBeInTheDocument();
    });
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('renders the store overview dashboard in Arabic under the RTL document direction', async () => {
    sellerApiMock.getStores.mockResolvedValue({
      items: [{ id: 'store_123', code: 'ST-1', name: 'Riyadh Front', status: 'active', market_code: 'SA' }]
    });
    sellerApiMock.listStoreProducts.mockResolvedValue({ items: [] });
    sellerApiMock.listStoreListings.mockResolvedValue({ items: [] });
    sellerApiMock.listStoreInventory.mockResolvedValue({ items: [] });
    sellerApiMock.listStoreOrders.mockResolvedValue({
      orders: [
        {
          id: 'ord_ovv_ar_1',
          order_number: 'ORD-OVV-AR01',
          status: 'confirmed',
          currency: 'SAR',
          total: 14500,
          item_count: 3,
          recipient_name: 'سارة العتيبي'
        }
      ],
      total: 1,
      limit: 8,
      offset: 0
    });
    sellerApiMock.getStoreBalance.mockResolvedValue({
      available_minor: 12500,
      pending_minor: 3000,
      currency: 'SAR',
      updated_at: '2026-10-01T10:00:00Z'
    });
    sellerApiMock.listStoreConnections.mockResolvedValue({
      items: [{ id: 'conn_ovv_ar_1', provider: 'salla', name: 'Salla Main Sync', status: 'active' }]
    });
    sellerApiMock.getStoreOperationalState.mockResolvedValue({ checkout_status: 'accepting' });
    sellerApiMock.getThemeInstallation.mockResolvedValue(null);
    sellerApiMock.getStorefrontHost.mockResolvedValue({ host: 'ST-1.localhost:3000' });

    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <LocaleProvider initialLocale="ar">
          <StoreOverviewPage params={Promise.resolve({ store_id: 'store_123' })} />
        </LocaleProvider>
      );
    });
    void utils;

    await waitFor(() => {
      expect(screen.getByText('ما يتطلب قرار البائع')).toBeInTheDocument();
    });

    // Fixed UI copy is localized in Arabic (hero actions, KPIs, panel titles, states).
    expect(screen.getByLabelText('ملخص أداء المتجر')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /إضافة منتج/ })).toHaveAttribute(
      'href',
      '/dashboard/stores/store_123/catalog/products/new'
    );
    expect(screen.getByRole('button', { name: /إيقاف الدفع مؤقتاً/ })).toBeInTheDocument();
    expect(screen.getByText('المنتجات')).toBeInTheDocument();
    expect(screen.getByText('الطلبات')).toBeInTheDocument();
    expect(screen.getByText('إجراءات سريعة')).toBeInTheDocument();
    expect(screen.getByText('تنبيهات المخزون')).toBeInTheDocument();
    expect(screen.getByText('لا توجد رموز SKU منخفضة المخزون.')).toBeInTheDocument();
    expect(screen.getByText('أسطح البيع')).toBeInTheDocument();
    expect(screen.getByText('السوق SA')).toBeInTheDocument();
    // Known server status enums are localized; unknown enums keep their raw server value.
    expect(screen.getAllByText('نشط').length).toBeGreaterThanOrEqual(1);
    expect(document.querySelector('.seller-orders-table')!.textContent).toContain('confirmed');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');

    // External/user data (store name, codes, IDs, quantities, amount currency, order number)
    // is preserved untouched by localization. Only known store statuses localize; the rest
    // of the data truth remains the server-provided values.
    const page = screen.getByText('إجراءات سريعة').closest('div.seller-dashboard')!;
    expect(page.textContent).toContain('Riyadh Front');
    expect(page.textContent).toContain('ST-1');
    expect(page.textContent).toContain('ORD-OVV-AR01');
    expect(page.textContent).toContain('سارة العتيبي');
    expect(page.textContent).toContain('SAR\u00a0125');
    expect(page.textContent).toContain('Salla Main Sync');
    expect(page.textContent).toContain('salla');
    expect(page.textContent).toContain('3 عنصر');
  });

  it('renders the store inventory route in Arabic under the RTL document direction', async () => {
    sellerApiMock.listStoreInventory.mockResolvedValue({
      items: [
        {
          id: 'snap_ar_1',
          fulfillment_location_id: 'loc_wh_1',
          location_name: 'Main Logistics Warehouse',
          sku_id: 'sku_ar_1',
          sku_code: 'TSHIRT-AR-L',
          on_hand_qty: 20,
          reserved_qty: 5,
          available_qty: 15,
          version: 1,
          updated_at: '2026-10-06T10:00:00Z'
        }
      ]
    });
    sellerApiMock.listStoreLocations.mockResolvedValue({
      items: [{ id: 'loc_wh_1', code: 'WH-01', name: 'Main Logistics Warehouse', location_type: 'warehouse' }]
    });
    sellerApiMock.listStoreProducts.mockResolvedValue({ items: [] });

    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <LocaleProvider initialLocale="ar">
          <StoreInventoryPage params={{ store_id: 'store_123' }} />
        </LocaleProvider>
      );
    });
    void utils;

    await waitFor(() => {
      expect(screen.getByText('لقطات مخزون المتجر')).toBeInTheDocument();
    });

    // Fixed UI copy is localized in Arabic (heading, form labels, mode toggles, actions).
    expect(screen.getByText('تعديل مخزون المتجر')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /فرق نسبي/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /هدف الجرد الفعلي/ })).toBeInTheDocument();
    expect(screen.getByLabelText('اختر SKU *')).toBeInTheDocument();
    expect(screen.getByLabelText('موقع التنفيذ *')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'مخزون مستلم' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'بضاعة تالفة' })).toBeInTheDocument();
    expect(screen.getByText('تطبيق التعديل')).toBeInTheDocument();

    // Table headers localized while the snapshot identifiers and quantities stay untouched.
    expect(screen.getByText('الموقع')).toBeInTheDocument();
    expect(screen.getByText('الفعلي')).toBeInTheDocument();
    expect(screen.getByText('المتاح')).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');

    const page = screen.getByText('لقطات مخزون المتجر').closest('div.space-y-6')!;
    expect(page.textContent).toContain('TSHIRT-AR-L');
    expect(page.textContent).toContain('sku_ar_1');
    expect(page.textContent).toContain('Main Logistics Warehouse');
    expect(page.textContent).toContain('loc_wh_1');
    expect(page.textContent).toContain('20');
    expect(page.textContent).toContain('15');
    expect(page.textContent).toContain('اختيار للتعديل');
  });

  it('renders the store categories screen in Arabic under the RTL document direction', async () => {
    sellerApiMock.listStoreCategories.mockResolvedValue([
      {
        id: 'cat_ar_1',
        store_id: 'store_123',
        parent_category_id: null,
        slug: 'tashreef',
        status: 'active',
        sort_order: 0,
        translations: { en: { name: 'Winter Jackets', description: 'Cold weather' }, ar: { name: 'جاكيتات الشتاء', description: '' } },
        product_count: 2,
        child_count: 1,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      }
    ]);

    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <LocaleProvider initialLocale="ar">
          <StoreCategoriesPage params={Promise.resolve({ store_id: 'store_123' })} />
        </LocaleProvider>
      );
    });
    void utils;

    await waitFor(() => {
      expect(screen.getByText('الفئات')).toBeInTheDocument();
    });

    // Fixed UI copy is localized in Arabic (heading, create action, loading state).
    expect(screen.getByText('نظّم منتجات متجرك في فئات هرمية ثنائية اللغة')).toBeInTheDocument();
    expect(screen.getByText('إنشاء فئة')).toBeInTheDocument();

    // Category tree renders with the Arabic name resolved from the translation,
    // while the slug and identifiers stay untouched (data truth).
    expect(screen.getByText('جاكيتات الشتاء')).toBeInTheDocument();
    const page = screen.getByText('الفئات').closest('div.mx-auto')!;
    expect(page.textContent).toContain('tashreef');

    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('renders the store listings queue in Arabic under RTL while preserving listing data truth', async () => {
    sellerApiMock.listStoreListings.mockResolvedValue({
      items: [
        {
          id: 'lst_ar_1',
          store_id: 'store_123',
          product_id: 'prod_ar_1',
          supplier_offer_id: null,
          market_code: 'SA',
          status: 'draft',
          created_at: '2026-10-01T10:00:00Z',
          updated_at: '2026-10-01T10:00:00Z'
        }
      ]
    });

    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <LocaleProvider initialLocale="ar">
          <StoreListingsPage params={Promise.resolve({ store_id: 'store_123' })} />
        </LocaleProvider>
      );
    });
    void utils;

    await waitFor(() => {
      expect(screen.getByText('قوائم المتجر')).toBeInTheDocument();
    });

    // Fixed UI copy is localized in Arabic (heading, link, filter options, table headers).
    expect(screen.getByRole('link', { name: 'عرض كتالوج المنتجات' })).toHaveAttribute(
      'href',
      '/dashboard/stores/store_123/catalog/products'
    );
    expect(screen.getByRole('option', { name: 'منشور' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'كل الحالات' })).toBeInTheDocument();
    expect(screen.getByText('معرّف القائمة')).toBeInTheDocument();
    expect(screen.getByText('حالة النشر')).toBeInTheDocument();
    expect(screen.getByText('الإجراءات')).toBeInTheDocument();
    expect(screen.getByText('مملوكة للبائع')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /إدارة/ })).toHaveAttribute(
      'href',
      '/dashboard/stores/store_123/catalog/listings/lst_ar_1'
    );
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');

    // The raw publish status enum and listing identifiers stay untouched.
    const page = screen.getByText('قوائم المتجر').closest('div.space-y-6')!;
    expect(page.textContent).toContain('lst_ar_1');
    expect(page.textContent).toContain('prod_ar_1');
    expect(page.textContent).toContain('SA');
    expect(page.textContent).toContain('draft');
  });

  it('renders the store products catalog in Arabic under RTL while preserving product data truth', async () => {
    sellerApiMock.listStoreProducts.mockResolvedValue({
      items: [
        {
          id: 'prod_idx_ar_1',
          store_id: 'store_123',
          source: 'seller_owned',
          slug: 'premium-cotton-t-shirt',
          name: 'Premium Cotton T-Shirt',
          status: 'active',
          current_price: { currency: 'SAR', amount_minor: 9500 },
          inventory_summary: { total_available: 10 },
          publish_readiness: { is_ready: true, reasons: [] },
          created_at: '2026-10-01T10:00:00Z',
          updated_at: '2026-10-02T10:00:00Z'
        }
      ]
    });
    sellerApiMock.getStoreProductDetail.mockResolvedValue({
      media: [{ id: 'md_link_1', uri: 'https://cdn.example.com/p1.png', is_primary: true, alt_text: 'p', product_id: 'prod_idx_ar_1', media_type: 'image/png', storage_key: '', sort_order: 0, metadata: {}, created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z' }]
    });
    sellerApiMock.listProductMediaReferences.mockResolvedValue({
      items: [{ is_primary: true, url: 'https://cdn.example.com/p1.png' }]
    });

    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <LocaleProvider initialLocale="ar">
          <StoreProductsPage params={Promise.resolve({ store_id: 'store_123' })} />
        </LocaleProvider>
      );
    });
    void utils;

    await waitFor(() => {
      expect(screen.getByText('كتالوج منتجات المتجر')).toBeInTheDocument();
    });

    // Fixed UI copy is localized in Arabic (header, filters, table headers, actions).
    expect(screen.getByText('كتالوج موحّد يجمع منتجات البائع والعناصر المدعومة من الموردين')).toBeInTheDocument();
    expect(screen.getByText('استيراد عرض مورد')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('الاسم، الرابط، المورد...')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'جميع المصادر' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'كل الحالات' })).toBeInTheDocument();
    expect(screen.getByText('اسم المنتج')).toBeInTheDocument();
    expect(screen.getByText('الجاهزية')).toBeInTheDocument();
    expect(screen.getAllByText('تعديل التفاصيل').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('جاهز للنشر')).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');

    // Product data truth is preserved while UI status labels are localized.
    const page = screen.getByText('كتالوج منتجات المتجر').closest('div.space-y-6')!;
    expect(page.textContent).toContain('Premium Cotton T-Shirt');
    expect(page.textContent).not.toContain('premium-cotton-t-shirt');
    await waitFor(() => {
      expect(screen.getByAltText('')).toHaveAttribute('src', 'https://cdn.example.com/p1.png');
    });
    expect(page.textContent).toContain('prod_idx');
    expect(page.textContent).toContain('نشط');
    expect(page.textContent).toContain('SAR');
  });

  it('renders the supplier offers page in Arabic under RTL while preserving offer data truth', async () => {
    sellerApiMock.listStoreSupplierOffers.mockResolvedValue({
      items: [
        {
          offer_id: 'off_ar_1',
          offer_status: 'active',
          market_code: 'SA',
          product_id: 'prod_aroffer_1',
          product_slug: 'oud-perfume-50ml',
          product_name: 'Luxury Oud 50ml',
          product_status: 'published',
          supplier_id: 'sup_ar_1',
          supplier_code: 'sup-a',
          supplier_name: 'Arabian Oils Co',
          price: { currency: 'SAR', amount_minor: 20000 },
          is_available: true,
          available_qty: 50,
          fulfillment_count: 1,
          updated_at: '2026-10-01T10:00:00Z'
        }
      ]
    } as never);

    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <LocaleProvider initialLocale="ar">
          <StoreSupplierOffersPage params={Promise.resolve({ store_id: 'store_123' })} />
        </LocaleProvider>
      );
    });
    void utils;

    await waitFor(() => {
      expect(screen.getByText('كتالوج عروض الموردين')).toBeInTheDocument();
    });

    // Fixed copy is localized in Arabic (header, search, card labels, and the import action).
    expect(screen.getByText('اكتشف عروض الموردين النشطة المؤهلة للاستيراد إلى المتجر')).toBeInTheDocument();
    expect(screen.getByText('عرض قوائم المتجر')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ابحث في عروض الموردين باسم المنتج أو المورد أو الفئة...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'بحث' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('سعر العرض:')).toBeInTheDocument();
    });
    const page0 = screen.getByText('كتالوج عروض الموردين').closest('div.space-y-6')!;
    expect(page0.textContent).toContain('المورد:');
    expect(page0.textContent).toContain('Arabian Oils Co');
    expect(screen.getByText('التوفر:').parentElement?.textContent).toContain('50');
    expect(screen.getByText('استيراد إلى كتالوج المتجر')).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');

    // Offer data truth is preserved untouched (IDs, supplier, market, price, currency).
    const page = screen.getByText('كتالوج عروض الموردين').closest('div.space-y-6')!;
    expect(page.textContent).toContain('Luxury Oud 50ml');
    expect(page.textContent).toContain('SA');
    expect(page.textContent).toContain('SAR');
    expect(page.textContent).toContain('200.00');
  });

  it('renders the supplier offer import modal in Arabic under RTL and preserves the markup import payload', async () => {
    sellerApiMock.listStoreSupplierOffers.mockResolvedValue({
      items: [
        {
          offer_id: 'off_ar_modal',
          offer_status: 'active',
          market_code: 'SA',
          product_id: 'prod_aroffer_modal',
          product_slug: 'oud-perfume-modal',
          product_name: 'Luxury Oud 50ml',
          product_status: 'published',
          supplier_id: 'sup_ar_modal',
          supplier_code: 'sup-b',
          supplier_name: 'Arabian Oils Co',
          price: { currency: 'SAR', amount_minor: 20000 },
          is_available: true,
          available_qty: 20,
          fulfillment_count: 1,
          updated_at: '2026-10-01T10:00:00Z'
        }
      ]
    } as never);
    sellerApiMock.importSupplierOffer.mockResolvedValue({
      id: 'lst_ar_import_1',
      store_id: 'store_123',
      product_id: 'prod_aroffer_modal',
      market_code: 'SA',
      status: 'draft',
      created_at: '2026-10-02T10:00:00Z',
      updated_at: '2026-10-02T10:00:00Z'
    } as never);

    await act(async () => {
      render(
        <LocaleProvider initialLocale="ar">
          <StoreSupplierOffersPage params={Promise.resolve({ store_id: 'store_123' })} />
        </LocaleProvider>
      );
    });

    fireEvent.click(await screen.findByText('استيراد إلى كتالوج المتجر'));
    expect(await screen.findByText('إعداد استيراد عرض المورد ونسبة الهامش')).toBeInTheDocument();
    expect(screen.getByText('نسبة الهامش المستهدفة (%)')).toBeInTheDocument();
    const modalRoot = screen.getByText('إعداد استيراد عرض المورد ونسبة الهامش').closest('.bg-white.rounded-lg')!;
    expect(modalRoot.textContent).toContain('تكلفة الجملة من المورد: 200.00 SAR');
    expect(screen.getByRole('button', { name: /تأكيد الاستيراد إلى كتالوج المتجر/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إلغاء' })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');

    // Confirm the RPM markup payload is preserved; then the Arabic success message shows the same numbers.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'تأكيد الاستيراد إلى كتالوج المتجر' }));
    });
    await waitFor(() => {
      expect(sellerApiMock.importSupplierOffer).toHaveBeenCalledWith('store_123', 'off_ar_modal', {
        markup_percentage: 20,
        retail_price_minor_units: 24000,
        shipping_subsidy_policy: 'buyer_paid'
      });
    });
    await waitFor(() => {
      expect(screen.getByText(/تم استيراد العرض ذريًا بهامش 20% وتم حفظ سعر التجزئة الابتدائي\./)).toBeInTheDocument();
    });
    expect(screen.getByText('الانتقال إلى القوائم')).toBeInTheDocument();
    expect(screen.getAllByText('مستورد').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the new seller product form in Arabic under RTL', async () => {
    sellerApiMock.listStoreCategories.mockResolvedValue([]);

    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <LocaleProvider initialLocale="ar">
          <NewStoreProductPage params={Promise.resolve({ store_id: 'store_123' })} />
        </LocaleProvider>
      );
    });
    void utils;

    await waitFor(() => {
      expect(screen.getByText('إضافة منتج جديد')).toBeInTheDocument();
    });

    // Form fixed copy and validation labels/placeholder are localized in Arabic.
    expect(screen.getByText('أضف منتجاً لمسودتك وراجعه قبل نشره في المتجر.')).toBeInTheDocument();
    expect(screen.getByText('اسم المنتج بالعربية *')).toBeInTheDocument();
    expect(screen.getByText('رابط المنتج المخصص')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('مثال: خلاط متعدد السرعات')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'حفظ كمسودة' })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('renders the product detail screen in Arabic under RTL while preserving product data truth', async () => {
    sellerApiMock.getStoreProductDetail.mockResolvedValue({
      product: {
        id: 'prod_ar_detail',
        slug: 'premium-cotton-t-shirt',
        status: 'active',
        created_at: '2026-10-01T10:00:00Z',
        updated_at: '2026-10-02T10:00:00Z'
      },
      source: 'seller_owned',
      translations: [
        { locale: 'en', name: 'Premium Cotton T-Shirt', description: 'Retail tee' },
        { locale: 'ar', name: 'تي-شيرت قطني فاخر', description: 'تيشيرت للبيع' }
      ],
      category_ids: [],
      store_category_ids: [],
      store_categories: [],
      variants: [],
      skus: [],
      media: [],
      listing: {
        id: 'lst_ar_prod_1',
        store_id: 'store_123',
        product_id: 'prod_ar_detail',
        market_code: 'SA',
        status: 'draft',
        created_at: '2026-10-03T10:00:00Z',
        updated_at: '2026-10-03T10:00:00Z'
      },
      current_price: { currency: 'SAR', amount_minor: 9500 },
      inventory_summary: {
        total_on_hand: 20,
        total_reserved: 5,
        total_available: 15,
        locations: [{ location_id: 'loc_wh_1', location_name: 'Main Logistics Warehouse', sku_id: 'sku_ar_1', on_hand_qty: 20, reserved_qty: 5, available_qty: 15 }]
      },
      publish_readiness: { is_ready: false, reasons: [] },
      purchase_behavior: 'owned_product'
    });
    sellerApiMock.listStoreMedia.mockResolvedValue({ items: [] });
    sellerApiMock.listProductMediaReferences.mockResolvedValue({ items: [] });

    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <LocaleProvider initialLocale="ar">
          <StoreProductDetailPage params={Promise.resolve({ store_id: 'store_123', product_id: 'prod_ar_detail' })} />
        </LocaleProvider>
      );
    });
    void utils;

    await waitFor(() => {
      expect(screen.getByText('تعديل المنتج')).toBeInTheDocument();
    });

    // The detail route intentionally reuses the add-product editor, including
    // its Arabic labels and editable product fields.
    expect(screen.getByText('البيانات الأساسية للمنتج')).toBeInTheDocument();
    expect(screen.getByText('وسائط وصور المنتج')).toBeInTheDocument();
    expect(screen.getByText('الخيارات والمتغيرات (Variants)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('تي-شيرت قطني فاخر')).toBeInTheDocument();
    expect(screen.getByDisplayValue('premium-cotton-t-shirt')).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('renders the listing detail screen in Arabic under RTL while preserving IDs, price and currency', async () => {
    sellerApiMock.getStoreListing.mockResolvedValue({
      id: 'lst_ar_detail',
      store_id: 'store_123',
      product_id: 'prod_ar_9',
      supplier_offer_id: null,
      market_code: 'SA',
      status: 'draft',
      created_at: '2026-10-01T10:00:00Z',
      updated_at: '2026-10-01T10:00:00Z'
    });
    sellerApiMock.getStoreListingLifecycle.mockResolvedValue({
      listing_id: 'lst_ar_detail',
      current_retail_price: { currency: 'SAR', amount_minor: 8500 },
      upstream_wholesale_price: { currency: 'SAR', amount_minor: 10000 },
      has_margin_warning: false
    });
    sellerApiMock.getListingReadiness.mockResolvedValue({ is_ready: false, reasons: [] });
    sellerApiMock.getStores.mockResolvedValue({
      items: [{ id: 'store_123', code: 'ST-1', name: 'Riyadh Front', market_code: 'SA' }]
    });

    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <LocaleProvider initialLocale="ar">
          <StoreListingDetailPage params={Promise.resolve({ store_id: 'store_123', listing_id: 'lst_ar_detail' })} />
        </LocaleProvider>
      );
    });
    void utils;

    await waitFor(() => {
      expect(screen.getByText('إدارة القائمة')).toBeInTheDocument();
    });

    // Fixed UI copy is localized in Arabic (lifecycle actions, form labels, economics table).
    expect(screen.getByText('نشر القائمة')).toBeInTheDocument();
    expect(screen.getByText('أرشفة القائمة')).toBeInTheDocument();
    expect(screen.getByText('هامش النسبة والتسعير للبيع')).toBeInTheDocument();
    expect(screen.getByText('العملة')).toBeInTheDocument();
    expect(screen.getByText('نسبة الهامش المستهدفة')).toBeInTheDocument();
    expect(screen.getByText('مبلغ سعر البيع')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('مثال: 20')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('مثال: 150.00')).toBeInTheDocument();
    expect(screen.getByText('تكلفة الجملة من المورد')).toBeInTheDocument();
    expect(screen.getByText('سعر البيع الحالي')).toBeInTheDocument();
    expect(screen.getByText('حفظ وتحديث سعر البيع')).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');

    // Listing identifiers, prices and the locked store currency stay untouched.
    const page = screen.getByText('إدارة القائمة').closest('div.space-y-6')!;
    expect(page.textContent).toContain('lst_ar_detail');
    expect(page.textContent).toContain('prod_ar_9');
    expect(page.textContent).toContain('draft');
    expect(page.textContent).toContain('85.00');
    // The sub-wholesale margin panel (retail below wholesale) renders with Arabic copy
    // while the numeric wholesale value is preserved.
    expect(screen.getByTestId('sub-wholesale-override-panel').textContent).toContain('أقل من تكلفة الجملة');
    expect(screen.getByTestId('sub-wholesale-override-panel').textContent).toContain('100.00');

    // The archive confirmation modal copy is localized in Arabic as well.
    fireEvent.click(screen.getByText('أرشفة القائمة'));
    expect(await screen.findByRole('dialog')).toHaveTextContent('أرشفة القائمة');
    expect(screen.getByText('الاحتفاظ بالقائمة')).toBeInTheDocument();
  });

  it('renders the store-segment error boundary in Arabic under RTL with data values preserved', () => {
    // The Arabic fallback message renders because the runtime error carries no message.
    const testError = { message: '', digest: 'abc123' } as Error & { digest?: string };
    const reset = vi.fn();

    act(() => {
      render(
        <LocaleProvider initialLocale="ar">
          <StoreSegmentError error={testError} reset={reset} />
        </LocaleProvider>
      );
    });

    expect(screen.getByText('حدث خطأ في عمليات المتجر')).toBeInTheDocument();
    expect(screen.getByText('تعذر إتمام العملية المطلوبة لهذا المتجر.')).toBeInTheDocument();
    expect(screen.getByText('إعادة تنفيذ العملية')).toBeInTheDocument();
    expect(screen.getByText('نظرة عامة على المتجر')).toBeInTheDocument();
    // Data-run values (the error digest) are preserved, not translated.
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('abc123');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');

    // The retry and back-link behaviour stays untouched.
    fireEvent.click(screen.getByText('إعادة تنفيذ العملية'));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByText('نظرة عامة على المتجر').closest('a')).toHaveAttribute(
      'href',
      '/dashboard/stores/store_123'
    );
  });
});
