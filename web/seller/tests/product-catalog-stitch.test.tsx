import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import StoreProductsPage from '../app/(dashboard)/dashboard/stores/[store_id]/catalog/products/page';
import { catalogMediaByProductId, catalogProducts } from './fixtures/catalog-products';

const { mocks } = vi.hoisted(() => ({
  mocks: {
    listStoreProducts: vi.fn(),
    listProductMediaReferences: vi.fn(),
    getStoreProductDetail: vi.fn(),
    removeStoreProduct: vi.fn(),
    bulkRemoveStoreProducts: vi.fn()
  }
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => null })
}));

vi.mock('../lib/api/client', () => ({
  sellerApi: {
    listStoreProducts: mocks.listStoreProducts,
    listProductMediaReferences: mocks.listProductMediaReferences,
    getStoreProductDetail: mocks.getStoreProductDetail,
    removeStoreProduct: mocks.removeStoreProduct,
    bulkRemoveStoreProducts: mocks.bulkRemoveStoreProducts
  }
}));

/** Emulates the server: filters + paginates over the fixture catalog. */
function serverEmulation(items = catalogProducts) {
  return async (_storeId: string, filters: Record<string, unknown> = {}) => {
    let result = [...items];
    const query = String(filters.query || '').trim().toLowerCase();
    if (query) {
      result = result.filter((p) =>
        [p.name, p.slug, p.supplier_name, p.supplier_code].some((value) =>
          value?.toLowerCase().includes(query)
        )
      );
    }
    if (filters.status && filters.status !== 'all') {
      result = result.filter((p) => (p.listing_status || p.status) === filters.status);
    }
    if (filters.source && filters.source !== 'all') {
      result = result.filter((p) => p.source === filters.source);
    }
    const limit = Number(filters.limit || 20);
    const offset = Number(filters.offset || 0);
    return { items: result.slice(offset, offset + limit), total: result.length, limit, offset };
  };
}

async function renderPage() {
  await act(async () => {
    render(<StoreProductsPage params={Promise.resolve({ store_id: 'store_123' })} />);
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.listStoreProducts.mockImplementation(serverEmulation());
  mocks.listProductMediaReferences.mockImplementation(async (_storeId: string, productId: string) => ({
    items:
      catalogMediaByProductId[productId] === undefined
        ? []
        : [{ is_primary: true, url: catalogMediaByProductId[productId] }]
  }));
  mocks.getStoreProductDetail.mockResolvedValue({ media: [] });
  mocks.removeStoreProduct.mockResolvedValue({ results: [] });
  mocks.bulkRemoveStoreProducts.mockResolvedValue({ results: [] });
});

describe('Catalog header and toolbar testids (US1)', () => {
  it('exposes stable testids for search, filters, views, and create', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Head Phone')).toBeInTheDocument());

    expect(screen.getByTestId('product-search')).toBeInTheDocument();
    expect(screen.getByTestId('product-filter-source')).toBeInTheDocument();
    expect(screen.getByTestId('product-filter-status')).toBeInTheDocument();
    expect(screen.getByTestId('product-create')).toBeInTheDocument();
    expect(screen.getByTestId('product-list-view')).toBeInTheDocument();
  });

  it('searches server-side by name and updates counts', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Head Phone')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('product-search'), { target: { value: 'charger' } });

    await waitFor(() => expect(screen.queryByText('Head Phone')).not.toBeInTheDocument());
    expect(screen.getByText('Fast Charger')).toBeInTheDocument();
    const lastCall = mocks.listStoreProducts.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(lastCall.query).toBe('charger');
  });

  it('filters by source and status through server params', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Head Phone')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('product-filter-source'), { target: { value: 'supplier_backed' } });
    await waitFor(() => expect(screen.getByText('Fast Charger')).toBeInTheDocument());
    expect(screen.queryByText('Head Phone')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('product-filter-source'), { target: { value: 'all' } });
    fireEvent.change(screen.getByTestId('product-filter-status'), { target: { value: 'archived' } });
    await waitFor(() => expect(screen.getByText('USB Cable')).toBeInTheDocument());
    expect(screen.queryByText('Head Phone')).not.toBeInTheDocument();

    const calls = mocks.listStoreProducts.mock.calls.map((call) => call[1]);
    expect(calls.some((filters) => (filters as Record<string, unknown>).source === 'supplier_backed')).toBe(true);
    expect(calls.some((filters) => (filters as Record<string, unknown>).status === 'archived')).toBe(true);
  });

  it('paginates and resets to the first page when search changes', async () => {
    mocks.listStoreProducts.mockImplementation(async (_storeId: string, filters: Record<string, unknown> = {}) => ({
      items: catalogProducts.slice(0, 2),
      total: 45,
      limit: Number(filters.limit || 20),
      offset: Number(filters.offset || 0)
    }));
    await renderPage();
    await waitFor(() => expect(screen.getByText('Head Phone')).toBeInTheDocument());

    expect(screen.getByText(/of 45/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => {
      const offsets = mocks.listStoreProducts.mock.calls.map((call) => (call[1] as Record<string, unknown>).offset);
      expect(offsets).toContain(20);
    });

    fireEvent.change(screen.getByTestId('product-search'), { target: { value: 'phone' } });
    await waitFor(() => {
      const offsets = mocks.listStoreProducts.mock.calls.map((call) => (call[1] as Record<string, unknown>).offset);
      expect(offsets.at(-1)).toBe(0);
    });
  });
});

describe('Catalog list and grid views (US2)', () => {
  it('shows the real primary image when available and hides the slug', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Head Phone')).toBeInTheDocument());

    const images = screen.getAllByTestId('product-image');
    expect(images.length).toBeGreaterThan(0);
    const shown = images.find((el) => el.tagName === 'IMG' && el.getAttribute('src') === 'https://cdn.example.test/head-phone.webp');
    expect(shown).toBeDefined();
    expect(screen.queryByText('head-phone')).not.toBeInTheDocument();
  });

  it('shows a placeholder only when no image exists', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Phone Case')).toBeInTheDocument());

    const placeholders = screen.getAllByLabelText('No product image');
    expect(placeholders.length).toBeGreaterThan(0);
    // Products with images render <img>, not placeholders.
    expect(screen.getByAltText('')).toHaveAttribute('src', 'https://cdn.example.test/head-phone.webp');
  });

  it('switches to grid cards preserving the product set and selection', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Head Phone')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Grid view' }));
    expect(screen.getByTestId('product-grid-view')).toBeInTheDocument();
    expect(screen.getAllByTestId('product-card').length).toBeGreaterThan(0);
    expect(screen.getByText('Head Phone')).toBeInTheDocument();
    expect(screen.getByText('Phone Case')).toBeInTheDocument();
    expect(screen.queryByText('head-phone')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(screen.getByTestId('product-list-view')).toBeInTheDocument();
  });

  it('selects visible, clears, selects a single product, and navigates to detail', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Head Phone')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /select visible/i }));
    await waitFor(() => expect(screen.getByText(/4 selected/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /clear selection/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /select visible/i })).toBeInTheDocument());

    const card = screen.getAllByTestId('product-card')[0];
    const checkbox = within(card).getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(screen.getByText(/1 selected/)).toBeInTheDocument();

    const detailLinks = screen.getAllByRole('link', { name: 'Head Phone' });
    expect(detailLinks[0]).toHaveAttribute('href', '/dashboard/stores/store_123/catalog/products/product_head');
  });
});

describe('Catalog states, RTL, and responsive integrity (US3)', () => {
  it('renders a loading skeleton while fetching', async () => {
    mocks.listStoreProducts.mockImplementation(() => new Promise(() => {}));
    await renderPage();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the empty state when nothing matches', async () => {
    mocks.listStoreProducts.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    await renderPage();
    await waitFor(() => expect(screen.getByText(/no products found/i)).toBeInTheDocument());
    expect(screen.getByText(/of 0/)).toBeInTheDocument();
  });

  it('renders the error state with retry and recovers', async () => {
    mocks.listStoreProducts.mockRejectedValueOnce(new Error('boom'));
    mocks.listStoreProducts.mockImplementation(serverEmulation());
    await renderPage();
    await waitFor(() => expect(screen.getByText(/could not load/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /retry|refresh/i }));
    await waitFor(() => expect(screen.getByText('Head Phone')).toBeInTheDocument());
  });

  it('distinguishes every product status', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Head Phone')).toBeInTheDocument());
    const list = within(screen.getByTestId('product-list-view'));
    expect(list.getByText('Published')).toBeInTheDocument();
    expect(list.getByText('Draft')).toBeInTheDocument();
    expect(list.getByText('Unpublished')).toBeInTheDocument();
    expect(list.getByText('Archived')).toBeInTheDocument();
  });

  it('renders in RTL without physical-direction breakage', async () => {
    document.documentElement.dir = 'rtl';
    try {
      await renderPage();
      await waitFor(() => expect(screen.getByText('Head Phone')).toBeInTheDocument());
      const table = screen.getByTestId('product-list-view').querySelector('table');
      expect(table?.className).toContain('text-start');
      expect(table?.className).not.toContain('text-left');
    } finally {
      document.documentElement.dir = '';
    }
  });

  it('keeps responsive grid and scrollable list containers', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Head Phone')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Grid view' }));
    const grid = screen.getByTestId('product-grid-view');
    expect(grid.className).toContain('sm:grid-cols-2');
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(screen.getByTestId('product-list-view').className).toContain('overflow-x-auto');
  });
});
