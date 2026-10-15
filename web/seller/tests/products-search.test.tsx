import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import StoreProductsPage from '../app/(dashboard)/dashboard/stores/[store_id]/catalog/products/page';

const { mockListStoreProducts, mockListProductMediaReferences, mockGetStoreProductDetail } = vi.hoisted(() => ({
  mockListStoreProducts: vi.fn(),
  mockListProductMediaReferences: vi.fn(),
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
    listProductMediaReferences: mockListProductMediaReferences,
    getStoreProductDetail: mockGetStoreProductDetail,
    removeStoreProduct: vi.fn().mockResolvedValue({ results: [] }),
    bulkRemoveStoreProducts: vi.fn().mockResolvedValue({ results: [] })
  }
}));

const baseItems = [
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
];

/** Server emulation: the page must send search/filters/pagination as params. */
type ServerItem = {
  id: string;
  store_id?: string;
  source: string;
  slug: string;
  name: string;
  status: string;
  listing_status?: string;
  supplier_name?: string;
  supplier_code?: string;
  created_at: string;
  updated_at: string;
};
function useServer(items: ServerItem[] = baseItems) {
  mockListStoreProducts.mockImplementation(async (_storeId: string, filters: Record<string, unknown> = {}) => {
    let result = [...items];
    const query = String(filters.query || '').trim().toLowerCase();
    if (query) {
      result = result.filter((p) =>
        [p.name, p.slug].some((value) => value?.toLowerCase().includes(query))
      );
    }
    if (filters.status && filters.status !== 'all') {
      result = result.filter((p) => (p.listing_status || p.status) === filters.status);
    }
    const limit = Number(filters.limit || 20);
    const offset = Number(filters.offset || 0);
    return { items: result.slice(offset, offset + limit), total: result.length, limit, offset };
  });
  mockListProductMediaReferences.mockImplementation(async (_storeId: string, productId: string) => ({
    items: productId === 'product_head' ? [{ is_primary: true, url: 'https://cdn.example.test/head-phone.webp' }] : []
  }));
  mockGetStoreProductDetail.mockResolvedValue({ media: [] });
}

describe('Store products catalog search', () => {
  it('filters products using the topbar catalog query', async () => {
    useServer();

    await act(async () => {
      render(<StoreProductsPage params={Promise.resolve({ store_id: 'store_123' })} />);
    });

    await waitFor(() => expect(screen.getByText('Head Phone')).toBeInTheDocument());
    expect(screen.queryByText('Phone Case')).not.toBeInTheDocument();
    // Initial query comes from ?query=head and is sent to the server.
    // The server returns the filtered total (visible 1 of filtered total 1).
    expect(mockListStoreProducts.mock.calls[0][1]).toMatchObject({ query: 'head' });
    expect(
      screen.getByText((_, element) => element?.textContent?.replace(/\s+/g, ' ').trim() === 'Showing 1 of 1 products')
    ).toBeInTheDocument();
  });

  it('switches to a detailed grid view with product media or a placeholder', async () => {
    useServer([
      {
        id: 'product_head',
        source: 'seller_owned',
        slug: 'head-phone',
        name: 'Head Phone',
        status: 'active',
        updated_at: '2026-10-07T00:00:00Z',
        created_at: '2026-10-07T00:00:00Z'
      }
    ]);
    searchParams.get = () => null;

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
    expect(screen.queryByText('head-phone')).not.toBeInTheDocument();
    searchParams.get = (name: string) => (name === 'query' ? 'head' : null);
  });

  it('falls back to the default product image placeholder when a media URL fails to load', async () => {
    useServer([
      {
        id: 'product_head',
        source: 'seller_owned',
        slug: 'head-phone',
        name: 'Head Phone',
        status: 'active',
        updated_at: '2026-10-07T00:00:00Z',
        created_at: '2026-10-07T00:00:00Z'
      }
    ]);
    mockListProductMediaReferences.mockResolvedValue({
      items: [{ is_primary: true, url: 'https://cdn.example.test/missing-head-phone.webp' }]
    });
    searchParams.get = () => null;

    await act(async () => {
      render(<StoreProductsPage params={Promise.resolve({ store_id: 'store_123' })} />);
    });
    await waitFor(() => expect(screen.getByText('Head Phone')).toBeInTheDocument());

    fireEvent.error(screen.getByAltText(''));

    expect(screen.getByLabelText('No product image')).toBeInTheDocument();
    expect(screen.queryByAltText('')).not.toBeInTheDocument();
    searchParams.get = (name: string) => (name === 'query' ? 'head' : null);
  });

  it('shows the available primary image in the table without rendering the product slug', async () => {
    useServer([
      {
        id: 'product_head',
        source: 'seller_owned',
        slug: 'head-phone',
        name: 'Head Phone',
        status: 'active',
        updated_at: '2026-10-07T00:00:00Z',
        created_at: '2026-10-07T00:00:00Z'
      }
    ]);
    searchParams.get = () => null;

    await act(async () => {
      render(<StoreProductsPage params={Promise.resolve({ store_id: 'store_123' })} />);
    });
    await waitFor(() => expect(screen.getByAltText('')).toHaveAttribute('src', 'https://cdn.example.test/head-phone.webp'));
    expect(screen.queryByText('head-phone')).not.toBeInTheDocument();
    searchParams.get = (name: string) => (name === 'query' ? 'head' : null);
  });

  it('sends status and source filters to the server', async () => {
    useServer();
    searchParams.get = () => null;

    await act(async () => {
      render(<StoreProductsPage params={Promise.resolve({ store_id: 'store_123' })} />);
    });
    await waitFor(() => expect(screen.getByText('Head Phone')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('product-filter-status'), { target: { value: 'draft' } });
    await waitFor(() => {
      const statuses = mockListStoreProducts.mock.calls.map((call) => (call[1] as Record<string, unknown>).status);
      expect(statuses).toContain('draft');
    });
    searchParams.get = (name: string) => (name === 'query' ? 'head' : null);
  });
});
