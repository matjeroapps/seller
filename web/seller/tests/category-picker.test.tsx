import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryPicker } from '../components/seller/CategoryPicker';
import { LocaleProvider } from '../lib/i18n/locale-context';
import type { StoreCategory } from '../lib/api/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/dashboard/stores/store_123/catalog/products'
}));

vi.mock('../lib/api/client', () => ({
  sellerApi: {},
  ApiError: class ApiError extends Error {}
}));

function category(overrides: Partial<StoreCategory>): StoreCategory {
  return {
    id: 'cat_x',
    store_id: 'store_123',
    parent_category_id: null,
    slug: 'cat-x',
    status: 'active',
    sort_order: 0,
    translations: { en: { name: 'Category X', description: '' } },
    product_count: 0,
    child_count: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

const root = category({ id: 'cat_root', slug: 'electronics', translations: { en: { name: 'Electronics', description: '' } } });
const child = category({
  id: 'cat_child',
  slug: 'audio',
  parent_category_id: 'cat_root',
  translations: { en: { name: 'Audio', description: '' }, ar: { name: 'صوتيات', description: '' } }
});
const inactive = category({ id: 'cat_inactive', slug: 'inactive-cat', status: 'inactive', translations: { en: { name: 'Inactive Cat', description: '' } } });
const archived = category({ id: 'cat_archived', slug: 'archived-cat', status: 'archived', translations: { en: { name: 'Archived Cat', description: '' } } });

function renderPicker(props: Partial<React.ComponentProps<typeof CategoryPicker>> = {}) {
  return render(
    <LocaleProvider>
      <CategoryPicker
        storeId="store_123"
        categories={[root, child, inactive, archived]}
        selectedIds={[]}
        onChange={() => {}}
        {...props}
      />
    </LocaleProvider>
  );
}

describe('CategoryPicker', () => {
  beforeEach(() => {
    document.cookie = 'mh_locale=en';
  });

  it('renders the hierarchy as indented readable names', () => {
    renderPicker();
    expect(screen.getByLabelText('Electronics')).toBeInTheDocument();
    expect(screen.getByLabelText('Audio')).toBeInTheDocument();
  });

  it('falls back to the English name when Arabic content is missing and renders Arabic when selected', () => {
    document.cookie = 'mh_locale=ar';
    renderPicker();
    // Audio has Arabic content; Electronics does not and falls back to English.
    expect(screen.getByLabelText('صوتيات')).toBeInTheDocument();
    expect(screen.getByLabelText('Electronics')).toBeInTheDocument();
  });

  it('pre-selects existing assignments', () => {
    renderPicker({ selectedIds: ['cat_root'] });
    expect((screen.getByLabelText('Electronics') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Audio') as HTMLInputElement).checked).toBe(false);
  });

  it('disables non-active categories for new selection but keeps assigned ones selected', () => {
    renderPicker({ selectedIds: ['cat_archived'] });
    // Unassigned non-active categories cannot be newly selected.
    expect((screen.getByLabelText('Inactive Cat') as HTMLInputElement).disabled).toBe(true);
    // Already-assigned archived category stays toggleable so the seller can remove it.
    expect((screen.getByLabelText('Archived Cat') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Archived Cat') as HTMLInputElement).disabled).toBe(false);
  });

  it('emits the updated selection through onChange', () => {
    const onChange = vi.fn();
    renderPicker({ onChange });
    fireEvent.click(screen.getByLabelText('Electronics'));
    expect(onChange).toHaveBeenCalledWith(['cat_root']);
  });

  it('shows an empty state with a link to the categories screen when the store has none', () => {
    renderPicker({ categories: [] });
    expect(screen.getByRole('link', { name: 'Manage categories' })).toHaveAttribute(
      'href',
      '/dashboard/stores/store_123/catalog/categories'
    );
  });

  it('shows a retry action when loading failed', () => {
    const onRetry = vi.fn();
    renderPicker({ categories: [], loadError: 'Categories unavailable', onRetry });
    fireEvent.click(screen.getByText('Try again'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
