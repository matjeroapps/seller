import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { SellerShell } from '../components/shell/SellerShell';

const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn()
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/stores/store_123/catalog/listings/listing_123',
  useRouter: () => ({ push: mockPush })
}));

vi.mock('../lib/api/merchant-console', () => ({
  fetchMerchantConsole: vi.fn(),
  isOperableWorkspace: vi.fn()
}));

describe('Seller shell catalog search', () => {
  it('provides a working searchbox that navigates with the catalog query', () => {
    render(
      <SellerShell
        user={{
          id: 'user_123',
          name: 'Ahmed Zidan',
          email: 'ahmed@example.test',
          roles: ['seller_owner']
        }}
      >
        <div>Page content</div>
      </SellerShell>
    );

    const searchbox = screen.getByRole('searchbox', { name: 'Search catalog' });
    fireEvent.change(searchbox, { target: { value: 'head phone' } });
    fireEvent.submit(searchbox.closest('form')!);

    expect(mockPush).toHaveBeenCalledWith('/dashboard/stores/store_123/catalog/products?query=head%20phone');
  });
});
