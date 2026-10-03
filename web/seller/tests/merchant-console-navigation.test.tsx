import { describe, expect, it } from 'vitest';

import {
  getNavigationForMerchantWorkspace,
  type MerchantWorkspaceNavigationContext
} from '../config/seller-navigation';

const OWNER = { permissions: ['retail.orders.manage', 'supply.catalog.manage', 'supply.fulfillment.manage'] };
const LIMITED = { permissions: ['retail.orders.manage'] };

function context(overrides: Partial<MerchantWorkspaceNavigationContext>): MerchantWorkspaceNavigationContext {
  return {
    merchantId: 'm-1',
    capabilities: { retail: 'active', supply: 'active' },
    permissions: OWNER.permissions,
    ...overrides
  };
}

function ids(nav: { id: string }[]) {
  return nav.map((item) => item.id);
}

describe('merchant console navigation (authorization acceptance matrix, UX layer)', () => {
  it('shows retail and supply modules for a dual-capability owner', () => {
    const nav = getNavigationForMerchantWorkspace(context({ storeId: 'store-1' }));
    expect(ids(nav)).toContain('catalog');
    expect(ids(nav)).toContain('orders');
    expect(ids(nav)).toContain('supply');
  });

  it('hides supply modules for a retail-only merchant owner', () => {
    const nav = getNavigationForMerchantWorkspace(context({ storeId: 'store-1', capabilities: { retail: 'active', supply: 'inactive' } }));
    expect(ids(nav)).toContain('catalog');
    expect(ids(nav)).not.toContain('supply');
  });

  it('hides retail modules for a supply-only merchant owner', () => {
    const nav = getNavigationForMerchantWorkspace(context({ storeId: 'store-1', capabilities: { retail: 'inactive', supply: 'active' } }));
    expect(ids(nav)).not.toContain('catalog');
    expect(ids(nav)).not.toContain('orders');
    expect(ids(nav)).toContain('supply');
  });

  it('hides supply modules for a suspended supply capability even with supply permissions', () => {
    const nav = getNavigationForMerchantWorkspace(context({ storeId: 'store-1', capabilities: { retail: 'active', supply: 'suspended' } }));
    expect(ids(nav)).not.toContain('supply');
    expect(ids(nav)).toContain('catalog');
  });

  it('hides retail modules for a suspended retail capability even with retail permissions', () => {
    const nav = getNavigationForMerchantWorkspace(context({ storeId: 'store-1', capabilities: { retail: 'suspended', supply: 'active' } }));
    expect(ids(nav)).not.toContain('catalog');
    expect(ids(nav)).toContain('supply');
  });

  it('hides supply modules for a limited staff member without supply permissions', () => {
    const nav = getNavigationForMerchantWorkspace(context({ storeId: 'store-1', permissions: LIMITED.permissions }));
    expect(ids(nav)).toContain('catalog');
    expect(ids(nav)).not.toContain('supply');
  });

  it('uses canonical merchant workspace paths', () => {
    const nav = getNavigationForMerchantWorkspace(context({ storeId: 'store-1' }));
    const catalog = nav.find((item) => item.id === 'catalog');
    expect(catalog?.path).toBe('/dashboard/merchants/m-1/stores/store-1/catalog/products');
    const supply = nav.find((item) => item.id === 'supply');
    expect(supply?.path).toBe('/dashboard/merchants/m-1/supply/connections');
    expect(supply?.children?.map((child) => child.path)).toEqual([
      '/dashboard/merchants/m-1/supply/connections',
      '/dashboard/merchants/m-1/supply/import-batches',
      '/dashboard/merchants/m-1/supply/review-cases',
      '/dashboard/merchants/m-1/supply/mappings',
      '/dashboard/merchants/m-1/supply/synchronization',
      '/dashboard/merchants/m-1/supply/fulfillment'
    ]);
  });

  it('renders the workspace root without store-scoped retail modules when no store is selected', () => {
    const nav = getNavigationForMerchantWorkspace(context({}));
    expect(ids(nav)).toEqual(['workspace-dashboard', 'supply', 'settings']);
  });

  it('grants merchant.manage members the full module set', () => {
    const nav = getNavigationForMerchantWorkspace(context({ storeId: 'store-1', permissions: ['merchant.manage'] }));
    expect(ids(nav)).toContain('catalog');
    expect(ids(nav)).toContain('supply');
    const supplyChildren = nav.find((item) => item.id === 'supply')?.children?.map((c) => c.id) || [];
    expect(supplyChildren).toContain('supply-fulfillment');
  });

  it('hides the fulfillment entry for a supply member without the fulfillment permission', () => {
    const nav = getNavigationForMerchantWorkspace(context({ storeId: 'store-1', permissions: ['supply.catalog.manage'] }));
    const supplyChildren = ids(nav.find((item) => item.id === 'supply')?.children || []);
    expect(supplyChildren).toContain('supply-connections');
    expect(supplyChildren).not.toContain('supply-fulfillment');
  });
});
