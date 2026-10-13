import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import NewStoreProductPage from '../app/(dashboard)/dashboard/stores/[store_id]/catalog/products/new/page';

const { mockPush, mockCreateStoreProduct } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockCreateStoreProduct: vi.fn()
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush
  })
}));

vi.mock('../lib/api/client', () => ({
  sellerApi: {
    createStoreProduct: mockCreateStoreProduct,
    listStoreCategories: vi.fn().mockResolvedValue([])
  }
}));

describe('New seller product slug generation', () => {
  async function renderPage() {
    await act(async () => {
      render(<NewStoreProductPage params={Promise.resolve({ store_id: 'store_123' })} />);
    });
  }

  it('updates the complete slug while the product name is being entered', async () => {
    await renderPage();

    await waitFor(() => expect(screen.getByRole('heading', { name: 'إضافة منتج جديد' })).toBeInTheDocument());
    const textboxes = screen.getAllByRole('textbox');
    const nameInput = screen.getByTestId('product-name-en');
    const slugInput = screen.getByTestId('product-slug');

    for (const value of ['P', 'Pr', 'Pre', 'Premium', 'Premium Cotton', 'Premium Cotton T-Shirt']) {
      fireEvent.change(nameInput, { target: { value } });
    }

    expect(slugInput).toHaveValue('premium-cotton-t-shirt');
  });

  it('stops replacing a slug after the seller edits it manually', async () => {
    await renderPage();

    await waitFor(() => expect(screen.getByRole('heading', { name: 'إضافة منتج جديد' })).toBeInTheDocument());
    const textboxes = screen.getAllByRole('textbox');
    const nameInput = screen.getByTestId('product-name-en');
    const slugInput = screen.getByTestId('product-slug');

    fireEvent.change(nameInput, { target: { value: 'Premium Cotton T-Shirt' } });
    fireEvent.change(slugInput, { target: { value: 'custom-product-url' } });
    fireEvent.change(nameInput, { target: { value: 'Different Product Name' } });

    expect(slugInput).toHaveValue('custom-product-url');
  });

  it('creates the product with editable Arabic and English translations', async () => {
    mockCreateStoreProduct.mockResolvedValueOnce({ id: 'product-1' });
    await renderPage();

    await waitFor(() => expect(screen.getByRole('heading', { name: 'إضافة منتج جديد' })).toBeInTheDocument());
    const textboxes = screen.getAllByRole('textbox');
    const nameAr = screen.getByTestId('product-name-ar');
    const nameEn = screen.getByTestId('product-name-en');
    const descriptionAr = screen.getByTestId('product-description-ar');
    const descriptionEn = screen.getByTestId('product-description-en');
    fireEvent.change(nameEn, { target: { value: 'Smart Air Fryer' } });
    fireEvent.change(nameAr, { target: { value: 'قلاية هوائية ذكية' } });
    fireEvent.change(descriptionEn, { target: { value: 'A smart kitchen appliance.' } });
    fireEvent.change(descriptionAr, { target: { value: 'جهاز مطبخ ذكي.' } });
    fireEvent.change(screen.getByTestId('retail-price'), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ كمسودة' }));

    await waitFor(() => expect(mockCreateStoreProduct).toHaveBeenCalledWith('store_123', {
      slug: 'smart-air-fryer',
      translations: [
        { locale: 'en', name: 'Smart Air Fryer', description: 'A smart kitchen appliance.' },
        { locale: 'ar', name: 'قلاية هوائية ذكية', description: 'جهاز مطبخ ذكي.' }
      ],
      store_category_ids: []
    }));
  });
});
