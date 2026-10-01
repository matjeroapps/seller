import { describe, expect, it } from 'vitest';

import { getNavigationForUserRoles, sellerNavigation, getNavigationForStore } from '../config/seller-navigation';

describe('seller navigation foundation', () => {
  it('defines the store-scoped seller information architecture', () => {
    expect(sellerNavigation.map((item) => item.id)).toEqual([
      'dashboard',
      'catalog',
      'orders',
      'shipments',
      'customers',
      'storefront',
      'analytics',
      'finance',
      'integrations',
      'settings'
    ]);
    expect(sellerNavigation.find((item) => item.id === 'catalog')?.children?.map((item) => item.id)).toEqual([
      'products',
      'supplier-offers',
      'listings',
      'inventory',
      'media'
    ]);
  });

  it('generates store-scoped navigation paths when store ID is provided', () => {
    const nav = getNavigationForStore('store_123');
    const catalogItem = nav.find((item) => item.id === 'catalog');
    expect(catalogItem?.path).toBe('/dashboard/stores/store_123/catalog/products');
    expect(catalogItem?.children?.[0].path).toBe('/dashboard/stores/store_123/catalog/products');
    expect(catalogItem?.children?.[1].path).toBe('/dashboard/stores/store_123/catalog/supplier-offers');
  });

  it('keeps role filtering as an extension point', () => {
    expect(getNavigationForUserRoles(['seller_owner'])).toBe(sellerNavigation);
  });
});
