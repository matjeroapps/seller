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
    listStoreCategories: vi.fn(),
    listStoreMedia: vi.fn(),
    listProductMediaReferences: vi.fn(),
    updateStoreProduct: vi.fn(),
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
    },
    store_category_ids: ['cat-electronics'],
    store_categories: [
      { id: 'cat-electronics', slug: 'electronics', status: 'active', name: 'Electronics' }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getStoreProductDetail.mockResolvedValue(sampleDetail);
    mockApi.listStoreCategories.mockResolvedValue([
      {
        id: 'cat-electronics',
        store_id: 'store_123',
        parent_category_id: null,
        slug: 'electronics',
        status: 'active',
        sort_order: 0,
        translations: { en: { name: 'Electronics', description: '' } },
        product_count: 0,
        child_count: 0,
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z'
      },
      {
        id: 'cat-accessories',
        store_id: 'store_123',
        parent_category_id: null,
        slug: 'accessories',
        status: 'active',
        sort_order: 1,
        translations: { en: { name: 'Accessories', description: '' } },
        product_count: 0,
        child_count: 0,
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z'
      }
    ]);
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

  it('renders a safe fallback when product detail arrays are null from the API', async () => {
    mockApi.getStoreProductDetail.mockResolvedValueOnce({
      ...sampleDetail,
      product: {
        ...sampleDetail.product,
        slug: 'fallback-product'
      },
      translations: null,
      variants: null,
      skus: null,
      category_ids: null,
      store_category_ids: ['cat-electronics'],
      store_categories: [
        { id: 'cat-electronics', slug: 'electronics', status: 'active', name: 'Electronics' }
      ],
      inventory_summary: {
        total_on_hand: 0,
        total_reserved: 0,
        total_available: 0,
        locations: null
      }
    });

    await renderPage(
      <StoreProductDetailPage
        params={Promise.resolve({ store_id: 'store_123', product_id: 'prod_456' })}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'fallback-product' })).toBeInTheDocument();
      expect(screen.getByText('No variants yet. Add the default variant before publishing this product.')).toBeInTheDocument();
      expect(screen.getByText('No inventory snapshots linked to this product yet.')).toBeInTheDocument();
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
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Detach image' }));

    await waitFor(() => {
      expect(mockApi.detachProductMedia).toHaveBeenCalledWith('store_123', 'prod_456', 'ref_1');
    });
  });

  it('renders the category picker with readable names and persists store category selection', async () => {
    mockApi.updateStoreProduct.mockResolvedValue(sampleDetail);

    await renderPage(
      <StoreProductDetailPage
        params={Promise.resolve({ store_id: 'store_123', product_id: 'prod_456' })}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('group', { name: 'Categories' })).toBeInTheDocument();
      // Readable localized names, not raw ids.
      expect(screen.getByLabelText('Electronics')).toBeInTheDocument();
      expect(screen.getByLabelText('Accessories')).toBeInTheDocument();
    });

    // Pre-selected from the product's existing assignments.
    expect((screen.getByLabelText('Electronics') as HTMLInputElement).checked).toBe(true);

    // Add a second category and save; store_category_ids carries the selection.
    fireEvent.click(screen.getByLabelText('Accessories'));
    fireEvent.click(screen.getByRole('button', { name: /save product details/i }));

    await waitFor(() => {
      expect(mockApi.updateStoreProduct).toHaveBeenCalledWith(
        'store_123',
        'prod_456',
        expect.objectContaining({ store_category_ids: ['cat-electronics', 'cat-accessories'] })
      );
    });
  });
});
