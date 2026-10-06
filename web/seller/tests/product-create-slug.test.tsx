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
    createStoreProduct: mockCreateStoreProduct
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

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Seller Product' })).toBeInTheDocument());
    const [nameInput, slugInput] = screen.getAllByRole('textbox');

    for (const value of ['P', 'Pr', 'Pre', 'Premium', 'Premium Cotton', 'Premium Cotton T-Shirt']) {
      fireEvent.change(nameInput, { target: { value } });
    }

    expect(slugInput).toHaveValue('premium-cotton-t-shirt');
  });

  it('stops replacing a slug after the seller edits it manually', async () => {
    await renderPage();

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Seller Product' })).toBeInTheDocument());
    const [nameInput, slugInput] = screen.getAllByRole('textbox');

    fireEvent.change(nameInput, { target: { value: 'Premium Cotton T-Shirt' } });
    fireEvent.change(slugInput, { target: { value: 'custom-product-url' } });
    fireEvent.change(nameInput, { target: { value: 'Different Product Name' } });

    expect(slugInput).toHaveValue('custom-product-url');
  });
});
