import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import StoreCategoriesPage from '../app/(dashboard)/dashboard/stores/[store_id]/catalog/categories/page';
import { sellerApi, ApiError } from '../lib/api/client';
import { LocaleProvider } from '../lib/i18n/locale-context';
import type { StoreCategory } from '../lib/api/types';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    listStoreCategories: vi.fn(),
    createStoreCategory: vi.fn(),
    updateStoreCategory: vi.fn(),
    updateStoreCategoryStatus: vi.fn(),
    deleteStoreCategory: vi.fn(),
    reorderStoreCategories: vi.fn()
  }
}));

vi.mock('../lib/api/client', () => ({
  sellerApi: mockApi,
  ApiError: class ApiError extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status: number) {
      super(message);
      this.code = code;
      this.status = status;
    }
  }
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/dashboard/stores/store_123/catalog/categories'
}));

const rootCategory: StoreCategory = {
  id: 'cat_root',
  store_id: 'store_123',
  parent_category_id: null,
  slug: 'winter-jackets',
  status: 'active',
  sort_order: 0,
  translations: {
    en: { name: 'Winter Jackets', description: 'Cold weather' },
    ar: { name: 'جاكيتات الشتاء', description: '' }
  },
  product_count: 2,
  child_count: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z'
};

const childCategory: StoreCategory = {
  id: 'cat_child',
  store_id: 'store_123',
  parent_category_id: 'cat_root',
  slug: 'parkas',
  status: 'active',
  sort_order: 0,
  translations: { en: { name: 'Parkas', description: '' } },
  product_count: 0,
  child_count: 0,
  created_at: '2026-01-02T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z'
};

function renderPage() {
  return act(async () => {
    render(
      <LocaleProvider>
        <StoreCategoriesPage params={{ store_id: 'store_123' }} />
      </LocaleProvider>
    );
  });
}

describe('store categories screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = 'mh_locale=en';
  });

  it('renders the loading state first', async () => {
    mockApi.listStoreCategories.mockReturnValue(new Promise(() => {}));
    await renderPage();
    expect(screen.getByText('Loading categories...')).toBeInTheDocument();
  });

  it('renders the empty state with a create CTA and no fabricated data', async () => {
    mockApi.listStoreCategories.mockResolvedValue([]);
    await renderPage();
    expect(screen.getByText('No categories yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create your first category/i })).toBeInTheDocument();
    expect(screen.queryByRole('tree')).not.toBeInTheDocument();
  });

  it('renders the error state with a retry action', async () => {
    mockApi.listStoreCategories.mockRejectedValue(new ApiError('unknown_error', 'boom', 500));
    await renderPage();
    expect(screen.getByText('boom')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    });
    expect(mockApi.listStoreCategories).toHaveBeenCalledTimes(2);
  });

  it('renders the hierarchy with localized names, counts and status', async () => {
    mockApi.listStoreCategories.mockResolvedValue([rootCategory, childCategory]);
    await renderPage();
    expect(screen.getByRole('tree')).toBeInTheDocument();
    expect(screen.getAllByText('Winter Jackets').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Parkas').length).toBeGreaterThan(0);
    expect(screen.getByText('1 subcategories')).toBeInTheDocument();
    expect(screen.getByText('2 products')).toBeInTheDocument();
  });

  it('creates a category through the form modal', async () => {
    mockApi.listStoreCategories.mockResolvedValue([]);
    const created = { ...rootCategory, id: 'cat_new', slug: 'sale', product_count: 0, child_count: 0 };
    mockApi.createStoreCategory.mockResolvedValue(created);
    await renderPage();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /create your first category/i }));
    });
    fireEvent.change(screen.getByLabelText(/english name/i), { target: { value: 'Sale' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    });

    await waitFor(() => {
      expect(mockApi.createStoreCategory).toHaveBeenCalledWith('store_123', expect.objectContaining({
        slug: 'sale',
        translations: expect.objectContaining({ en: expect.objectContaining({ name: 'Sale' }) })
      }));
    });
    expect(await screen.findByRole('tree')).toBeInTheDocument();
  });

  it('surfaces a slug conflict as a field-level error', async () => {
    mockApi.listStoreCategories.mockResolvedValue([]);
    mockApi.createStoreCategory.mockRejectedValue(
      Object.assign(new Error('conflict'), { status: 409 })
    );
    await renderPage();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /create your first category/i }));
    });
    fireEvent.change(screen.getByLabelText(/english name/i), { target: { value: 'Sale' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('This slug is already used in this store.')).toBeInTheDocument();
    });
  });

  it('rejects invalid slugs client-side before saving', async () => {
    mockApi.listStoreCategories.mockResolvedValue([]);
    await renderPage();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /create your first category/i }));
    });
    fireEvent.change(screen.getByLabelText(/english name/i), { target: { value: 'Sale' } });
    fireEvent.change(screen.getByLabelText(/slug/i), { target: { value: 'Bad Slug!' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    });

    expect(mockApi.createStoreCategory).not.toHaveBeenCalled();
  });

  it('deactivates a category after confirmation', async () => {
    mockApi.listStoreCategories.mockResolvedValue([rootCategory, childCategory]);
    mockApi.updateStoreCategoryStatus.mockResolvedValue({ ...rootCategory, status: 'inactive' });
    await renderPage();

    const deactivateButtons = screen.getAllByRole('button', { name: /deactivate: /i });
    await act(async () => {
      fireEvent.click(deactivateButtons[0]);
    });
    // Confirmation dialog appears first (destructive action).
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    });
    await waitFor(() => {
      expect(mockApi.updateStoreCategoryStatus).toHaveBeenCalledWith('store_123', 'cat_root', 'inactive');
    });
  });

  it('disables delete for categories with children or products', async () => {
    mockApi.listStoreCategories.mockResolvedValue([rootCategory, childCategory]);
    await renderPage();

    const deleteButtons = screen.getAllByRole('button', { name: new RegExp(`delete: `, 'i') });
    const rootDelete = deleteButtons.find((button) =>
      (button as HTMLButtonElement).getAttribute('aria-label')?.includes('Winter Jackets')
    );
    expect(rootDelete).toBeDisabled();
  });

  it('reorders siblings via move up/down and submits the changed pairs', async () => {
    const a = {
      ...rootCategory,
      id: 'cat_a',
      slug: 'a',
      sort_order: 0,
      child_count: 0,
      product_count: 0,
      translations: { en: { name: 'Category A', description: '' } }
    };
    const b = {
      ...rootCategory,
      id: 'cat_b',
      slug: 'b',
      sort_order: 1,
      child_count: 0,
      product_count: 0,
      translations: { en: { name: 'Category B', description: '' } }
    };
    mockApi.listStoreCategories.mockResolvedValue([a, b]);
    mockApi.reorderStoreCategories.mockResolvedValue({ status: 'ok' });
    await renderPage();

    const moveUpB = screen
      .getAllByRole('button', { name: /move up: /i })
      .find((button) => (button as HTMLButtonElement).getAttribute('aria-label')?.includes('Category B'));
    await act(async () => {
      fireEvent.click(moveUpB as HTMLElement);
    });

    await waitFor(() => {
      expect(mockApi.reorderStoreCategories).toHaveBeenCalledWith('store_123', [
        { id: 'cat_b', sort_order: 0 },
        { id: 'cat_a', sort_order: 1 }
      ]);
    });
  });
});
