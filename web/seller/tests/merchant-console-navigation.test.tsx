import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';

import { StoreSwitcher } from '../components/shell/StoreSwitcher';
import {
  getNavigationForMerchantWorkspace,
  getNavigationForStore,
  type MerchantWorkspaceNavigationContext
} from '../config/seller-navigation';

const { navMocks } = vi.hoisted(() => ({
  navMocks: { push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navMocks,
  usePathname: () => '/dashboard/merchants/m-1',
  useSearchParams: () => new URLSearchParams()
}));

const { mockSellerApi } = vi.hoisted(() => ({
  mockSellerApi: { getStores: vi.fn() }
}));

vi.mock('../lib/api/client', () => ({ sellerApi: mockSellerApi, sellerClient: mockSellerApi }));

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

describe('selected-store versus workspace-root navigation (T008)', () => {
  it('nests retail navigation under the URL-selected store', () => {
    const nav = getNavigationForMerchantWorkspace(context({ storeId: 'store-1' }));
    const catalog = nav.find((item) => item.id === 'catalog');
    expect(catalog?.path).toBe('/dashboard/merchants/m-1/stores/store-1/catalog/products');
    expect(nav.find((item) => item.id === 'orders')?.path).toBe('/dashboard/merchants/m-1/stores/store-1/orders');
  });

  it('keeps workspace-only navigation at workspace scope when no store is selected', () => {
    const nav = getNavigationForMerchantWorkspace(context({}));
    ids(nav).forEach((id) => expect(id.startsWith('supply-') || ['workspace-dashboard', 'supply', 'settings'].includes(id)).toBe(true));
    const settings = nav.find((item) => item.id === 'settings');
    expect(settings?.path).toBe('/dashboard/merchants/m-1');
    expect(settings?.children?.every((child) => child.path === '/dashboard/merchants/m-1')).toBe(true);
  });

  it('emits store-scoped legacy navigation only for a concrete selected store', () => {
    const storeNav = getNavigationForStore('st-1');
    expect(storeNav.find((item) => item.id === 'catalog')?.path).toBe('/dashboard/stores/st-1/catalog/products');
    const unselectedNav = getNavigationForStore();
    expect(unselectedNav.every((item) => !item.tenantScoped)).toBe(true);
    expect(unselectedNav.find((item) => item.id === 'dashboard')?.path).toBe('/dashboard');
  });
});

describe('every visible navigation item resolves to an available authorized screen (T012)', () => {
  // Screen implementations that exist under /dashboard/stores/{store_id} (the
  // canonical merchant store URLs are served from these via the preserve-URL
  // rewrites in next.config.ts) plus the workspace/supply screens.
  const storeScreens = new Set(
    ['', '/settings', '/account', '/catalog/products', '/catalog/supplier-offers', '/catalog/listings', '/catalog/categories', '/inventory', '/media', '/orders', '/storefront', '/finance', '/integrations'].map(
      (suffix) => suffix
    )
  );
  const workspaceScreens = new Set(['', '/supply/connections', '/supply/import-batches', '/supply/review-cases', '/supply/mappings', '/supply/synchronization', '/supply/fulfillment']);

  it('resolves store-scoped navigation paths onto existing store screens', () => {
    const nav = getNavigationForMerchantWorkspace(context({ storeId: 'store-1' })).filter((item) => item.id !== 'supply');
    getFlatPaths(nav).forEach((path) => {
      const storeRelative = path.replace('/dashboard/merchants/m-1/stores/store-1', '');
      const workspaceRelative = path.replace('/dashboard/merchants/m-1', '');
      expect(storeScreens.has(storeRelative) || workspaceScreens.has(workspaceRelative)).toBe(true);
    });
  });

  it('resolves workspace-scope navigation paths onto existing workspace screens', () => {
    const nav = getNavigationForMerchantWorkspace(context({}));
    getFlatPaths(nav).forEach((path) => {
      const workspaceRelative = path.replace('/dashboard/merchants/m-1', '');
      expect(workspaceScreens.has(workspaceRelative)).toBe(true);
    });
  });
});

function getFlatPaths(items: { path: string; children?: { path: string }[] }[]) {
  return items.flatMap((item) => [item.path, ...(item.children || []).map((child) => child.path)]);
}

describe('store switcher explicit selection (T008/T011)', () => {
  const workspaceStores = [
    { id: 's-1', code: 'alpha', name: 'Store Alpha', status: 'active', market_code: 'SA' },
    { id: 's-2', code: 'beta', name: 'Store Beta', status: 'active', market_code: 'SA' }
  ];

  async function renderSwitcher(currentStoreId?: string) {
    mockSellerApi.getStores.mockResolvedValue({ items: [], active_store_limit: 1, active_store_count: 0 });
    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <StoreSwitcher currentStoreId={currentStoreId} workspaceStores={workspaceStores} workspaceMerchantId="m-1" />
      );
    });
    return utils;
  }

  it('does not present a workspace store as selected before its route is selected', async () => {
    const utils = await renderSwitcher(undefined);
    const trigger = utils.getByTestId('store-switcher');
    expect(trigger.textContent).toContain('Select Store');
    expect(trigger.textContent).not.toContain('Store Alpha');
  });

  it('does not silently fall back to the first store when the URL store is stale', async () => {
    const utils = await renderSwitcher('stale-store');
    const trigger = utils.getByTestId('store-switcher');
    expect(trigger.textContent).toContain('Select Store');
    expect(trigger.textContent).not.toContain('Store Alpha');
  });

  it('still lists authorized stores and navigates the canonical store path on explicit selection', async () => {
    const utils = await renderSwitcher('s-1');
    act(() => {
      fireEvent.click(utils.getByTestId('store-switcher'));
    });
    const option = utils.getByTestId('store-switcher-option-beta');
    act(() => {
      fireEvent.click(option);
    });
    expect(navMocks.push).toHaveBeenCalledWith('/dashboard/merchants/m-1/stores/s-2');
  });
});
