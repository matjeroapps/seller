import { describe, expect, it } from 'vitest';

import { getNavigationForUserRoles, sellerNavigation } from '../config/seller-navigation';

describe('seller navigation foundation', () => {
  it('defines the seller information architecture without business handlers', () => {
    expect(sellerNavigation.map((item) => item.id)).toEqual([
      'dashboard',
      'catalog',
      'orders',
      'customers',
      'storefront',
      'analytics',
      'settings'
    ]);
    expect(sellerNavigation.find((item) => item.id === 'catalog')?.children?.map((item) => item.id)).toEqual([
      'products',
      'variants',
      'inventory'
    ]);
  });

  it('keeps role filtering as a future extension point', () => {
    expect(getNavigationForUserRoles(['seller_owner'])).toBe(sellerNavigation);
  });
});
