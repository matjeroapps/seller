import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import StoreProductDetailPage from '../app/(dashboard)/dashboard/stores/[store_id]/catalog/products/[product_id]/page';
import { sellerApi } from '../lib/api/client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn()
  }),
  usePathname: () => '/dashboard/stores/store_123/catalog/products/prod_456'
}));

const { mockApi } = vi.hoisted(() => {
  const mockApi = {
    getStoreProductDetail: vi.fn(),
    listStoreMedia: vi.fn(),
    listProductMediaReferences: vi.fn(),
    updateProductTranslations: vi.fn(),
    updateProductSlug: vi.fn(),
    updateProductStatus: vi.fn(),
    archiveProduct: vi.fn(),
    createProductVariant: vi.fn(),
    updateProductVariant: vi.fn(),
    createProductSku: vi.fn(),
    updateProductSku: vi.fn(),
    attachProductMedia: vi.fn(),
    detachProductMedia: vi.fn()
  };
  return { mockApi };
});

vi.mock('../lib/api/client', () => ({
  sellerApi: mockApi,
  sellerClient: mockApi
}));

async function renderPage(ui: React.ReactElement) {
  let utils: ReturnType<typeof render>;
  await act(async () => {
    utils = render(ui);
  });
  return utils!;
}

describe('Product Detail Actions & In-App ConfirmModal (T004-T009)', () => {
  const sampleDetail = {
    product: {
      id: 'prod_456',
      store_id: 'store_123',
      source: 'seller_owned',
      slug: 'leather-wallet',
      status: 'active',
      created_at: '2026-10-06T00:00:00Z',
      updated_at: '2026-10-06T00:00:00Z'
    },
    translations: [
      {
        id: 'trans_en',
        locale: 'en',
        name: 'Classic Leather Wallet',
        description: 'Premium handcrafted leather wallet.'
      },
      {
        id: 'trans_ar',
        locale: 'ar',
        name: 'محفظة جلدية كلاسيكية',
        description: 'محفظة جلدية فاخرة مصنوعة يدوياً.'
      }
    ],
    variants: [
      {
        id: 'var_1',
        product_id: 'prod_456',
        code: 'COLOR-BROWN',
        status: 'active',
        created_at: '2026-10-06T00:00:00Z'
      }
    ],
    skus: [
      {
        id: 'sku_1',
        variant_id: 'var_1',
        code: 'SKU-WAL-BRN-01',
        barcode: '1234567890123',
        status: 'active',
        created_at: '2026-10-06T00:00:00Z'
      }
    ],
    inventory: [],
    source: 'seller_owned',
    readiness: {
      is_ready: true,
      missing_requirements: []
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getStoreProductDetail.mockResolvedValue(sampleDetail);
    mockApi.listStoreMedia.mockResolvedValue({
      items: [
        {
          id: 'asset_1',
          store_id: 'store_123',
          file_name: 'wallet.png',
          url: 'https://cdn.example.com/wallet.png',
          mime_type: 'image/png',
          size_bytes: 1024,
          created_at: '2026-10-06T00:00:00Z'
        }
      ]
    });
    mockApi.listProductMediaReferences.mockResolvedValue({
      items: [
        {
          id: 'ref_1',
          product_id: 'prod_456',
          asset_id: 'asset_1',
          url: 'https://cdn.example.com/wallet.png',
          alt_text: 'Wallet Preview',
          is_primary: true
        }
      ]
    });
  });

  it('renders multilingual product details, variants, and attached media', async () => {
    await renderPage(
      <StoreProductDetailPage
        params={Promise.resolve({ store_id: 'store_123', product_id: 'prod_456' })}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Classic Leather Wallet')).toBeInTheDocument();
      expect(screen.getByDisplayValue('محفظة جلدية كلاسيكية')).toBeInTheDocument();
      expect(screen.getByDisplayValue('leather-wallet')).toBeInTheDocument();
      expect(screen.getByDisplayValue('COLOR-BROWN')).toBeInTheDocument();
      expect(screen.getByDisplayValue('SKU-WAL-BRN-01')).toBeInTheDocument();
    });
  });

  it('triggers in-app ConfirmModal when clicking Archive without native window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');

    await renderPage(
      <StoreProductDetailPage
        params={Promise.resolve({ store_id: 'store_123', product_id: 'prod_456' })}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /archive/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /archive/i }));

    // window.confirm should NOT be called
    expect(confirmSpy).not.toHaveBeenCalled();

    // ConfirmModal dialog should appear
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Archive Product' })).toBeInTheDocument();

    // Confirm the archive action
    mockApi.archiveProduct.mockResolvedValue({});
    fireEvent.click(screen.getByRole('button', { name: 'Archive Product' }));

    await waitFor(() => {
      expect(mockApi.archiveProduct).toHaveBeenCalledWith('store_123', 'prod_456');
    });

    confirmSpy.mockRestore();
  });

  it('attaches and detaches media references', async () => {
    mockApi.detachProductMedia.mockResolvedValue({});

    await renderPage(
      <StoreProductDetailPage
        params={Promise.resolve({ store_id: 'store_123', product_id: 'prod_456' })}
      />
    );

    await waitFor(() => {
      expect(screen.getByTitle('Detach reference')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Detach reference'));

    await waitFor(() => {
      expect(mockApi.detachProductMedia).toHaveBeenCalledWith('store_123', 'prod_456', 'ref_1');
    });
  });
});
