import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';

import StoreProductsPage from '../app/(dashboard)/dashboard/stores/[store_id]/catalog/products/page';

const { mockListStoreProducts, mockGetStoreProductDetail } = vi.hoisted(() => ({
  mockListStoreProducts: vi.fn(),
  mockGetStoreProductDetail: vi.fn()
}));

const searchParams = {
  get: (name: string) => (name === 'query' ? 'head' : null)
};

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams
}));

vi.mock('../lib/api/client', () => ({
  sellerApi: {
    listStoreProducts: mockListStoreProducts,
    getStoreProductDetail: mockGetStoreProductDetail
  }
}));

describe('Store products catalog search', () => {
  it('filters products using the topbar catalog query', async () => {
    mockListStoreProducts.mockResolvedValue({
      items: [
        {
          id: 'product_head',
          store_id: 'store_123',
          source: 'seller_owned',
          slug: 'head-phone',
          name: 'Head Phone',
          status: 'active',
          created_at: '2026-10-07T00:00:00Z',
          updated_at: '2026-10-07T00:00:00Z'
        },
        {
          id: 'product_case',
          store_id: 'store_123',
          source: 'seller_owned',
          slug: 'phone-case',
          name: 'Phone Case',
          status: 'active',
          created_at: '2026-10-07T00:00:00Z',
          updated_at: '2026-10-07T00:00:00Z'
        }
      ]
    });
    mockGetStoreProductDetail.mockImplementation(async (_storeId: string, productId: string) => ({
      primary_media_uri: productId === 'product_head' ? 'https://cdn.example.test/head-phone.webp' : undefined,
      media: [],
      translations: [],
      product: {},
      source: 'seller_owned',
      category_ids: [],
      store_category_ids: [],
      store_categories: [],
      variants: [],
      skus: [],
      listing: {},
      inventory_summary: {},
      publish_readiness: {}
    }));

    await act(async () => {
      render(<StoreProductsPage params={Promise.resolve({ store_id: 'store_123' })} />);
    });

    await waitFor(() => expect(screen.getByText('Head Phone')).toBeInTheDocument());
    expect(screen.queryByText('Phone Case')).not.toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent?.replace(/\s+/g, ' ').trim() === 'Showing 1 of 2 products')
    ).toBeInTheDocument();
  });

  it('switches to a detailed grid view with product media or a placeholder', async () => {
    mockListStoreProducts.mockResolvedValue({
      items: [
        {
          id: 'product_head',
          source: 'seller_owned',
          slug: 'head-phone',
          name: 'Head Phone',
          status: 'active',
          updated_at: '2026-10-07T00:00:00Z',
          created_at: '2026-10-07T00:00:00Z'
        }
      ]
    });
    mockGetStoreProductDetail.mockResolvedValue({
      primary_media_uri: 'https://cdn.example.test/head-phone.webp',
      media: [],
      translations: [],
      product: {},
      source: 'seller_owned',
      category_ids: [],
      store_category_ids: [],
      store_categories: [],
      variants: [],
      skus: [],
      listing: {},
      inventory_summary: {},
      publish_readiness: {}
    });

    await act(async () => {
      render(<StoreProductsPage params={Promise.resolve({ store_id: 'store_123' })} />);
    });
    await waitFor(() => expect(screen.getByText('Head Phone')).toBeInTheDocument());

    await act(async () => {
      screen.getByRole('button', { name: 'Grid view' }).click();
    });

    expect(screen.getByRole('button', { name: 'Grid view' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Retail price')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByAltText('Head Phone')).toHaveAttribute('src', 'https://cdn.example.test/head-phone.webp');
  });
});
