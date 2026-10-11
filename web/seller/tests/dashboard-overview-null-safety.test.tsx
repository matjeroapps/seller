import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import StoreOverviewPage from '../app/(dashboard)/dashboard/stores/[store_id]/page';
import { DashboardOverview } from '../components/dashboard/DashboardOverview';
import { fetchMerchantConsole } from '../lib/api/merchant-console';
import { sellerApi } from '../lib/api/client';

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockRouter = {
  push: mockPush,
  replace: mockReplace,
  refresh: vi.fn(),
  prefetch: vi.fn()
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams()
}));

vi.mock('../lib/api/merchant-console', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/api/merchant-console')>();
  return {
    ...original,
    fetchMerchantConsole: vi.fn()
  };
});

const fetchConsole = vi.mocked(fetchMerchantConsole);

const { mockApi } = vi.hoisted(() => {
  const mockApi = {
    getStores: vi.fn(),
    listStoreProducts: vi.fn(),
    listStoreListings: vi.fn(),
    listStoreInventory: vi.fn(),
    listStoreOrders: vi.fn(),
    getStoreBalance: vi.fn(),
    listStoreConnections: vi.fn(),
    getStoreOperationalState: vi.fn(),
    getThemeInstallation: vi.fn(),
    getStorefrontHost: vi.fn(),
    updateStoreStatus: vi.fn(),
    updateStoreOperationalState: vi.fn()
  };
  return { mockApi };
});

vi.mock('../lib/api/client', () => ({
  sellerApi: mockApi,
  sellerClient: mockApi
}));

async function renderPage(ui: React.ReactElement) {
  let utils: ReturnType<typeof render>;
  await act(async () => {
    utils = render(ui);
  });
  return utils!;
}

type AnyStore = { id: string; code: string; name: string; status: string; market_code: string };

function wsStore(id: string, status = 'active'): AnyStore {
  return { id, code: id.replace(/[^a-z0-9]/gi, '').toLowerCase(), name: `Store ${id}`, status, market_code: 'SA' };
}

function workspace(id: string, stores: AnyStore[], overrides: Record<string, unknown> = {}) {
  return {
    merchant_id: id,
    merchant_code: id.toUpperCase(),
    legal_name: `Merchant ${id}`,
    merchant_status: 'active',
    membership: { id: `mem-${id}`, status: 'active', permissions: ['retail.orders.manage'] },
    stores,
    ...overrides
  } as any;
}

describe('Direct entry resolution from /dashboard (US1 entry cases)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getStores.mockResolvedValue({ items: [] });
  });

  async function renderWith(bootstrap: unknown) {
    fetchConsole.mockResolvedValue(bootstrap as any);
    await renderPage(<DashboardOverview />);
  }

  it('directly enters the only enterable workspace and its single active authorized store (draft store tolerated)', async () => {
    await renderWith({ contract_version: 'merchant-console/v1', workspaces: [workspace('m-1', [wsStore('s-1'), wsStore('s-draft', 'draft')])] });

    await waitFor(
      () => {
        expect(mockReplace).toHaveBeenCalledWith('/dashboard/merchants/m-1/stores/s-1');
      },
      { timeout: 1000 }
    );
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('does not direct-enter when the only workspace has multiple active stores and keeps explicit selection', async () => {
    await renderWith({ contract_version: 'merchant-console/v1', workspaces: [workspace('m-1', [wsStore('s-1'), wsStore('s-2')])] });

    expect(mockReplace).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('merchant-workspace-card-M-1')).toBeInTheDocument(), { timeout: 1000 });
  });

  it('keeps the workspace chooser when more than one workspace is enterable', async () => {
    await renderWith({ contract_version: 'merchant-console/v1', workspaces: [workspace('m-1', [wsStore('s-1')]), workspace('m-2', [wsStore('s-9')])] });

    await waitFor(async () => {
      expect(screen.getByTestId('merchant-workspace-card-M-1')).toBeInTheDocument();
      expect(screen.getByTestId('merchant-workspace-card-M-2')).toBeInTheDocument();
    }, { timeout: 1000 });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not direct-enter a fallback store when the only workspace has zero active stores', async () => {
    await renderWith({ contract_version: 'merchant-console/v1', workspaces: [workspace('m-1', [wsStore('s-1', 'draft')])] });

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalledWith('/dashboard/merchants/m-1/stores/s-1');
    await waitFor(() => expect(screen.getByTestId('merchant-workspace-card-M-1')).toBeInTheDocument(), { timeout: 1000 });
  });

  it('routes zero enterable workspaces to the honest onboarding/access state', async () => {
    await renderWith({
      contract_version: 'merchant-console/v1',
      workspaces: [workspace('m-1', [], { membership: { id: 'mem-1', status: 'invited', permissions: [] } })]
    });

    await waitFor(
      () => {
        expect(mockReplace).toHaveBeenCalledWith('/dashboard/onboarding');
      },
      { timeout: 1000 }
    );
  });

  it('excludes inactive and historical workspace records from the enterable count', async () => {
    await renderWith({
      contract_version: 'merchant-console/v1',
      workspaces: [
        workspace('m-1', [wsStore('s-1')]),
        workspace('m-2', [wsStore('s-2')], { merchant_status: 'suspended', membership: { id: 'mem-2', status: 'active', permissions: [] } }),
        workspace('m-3', [wsStore('s-3')], { membership: { id: 'mem-3', status: 'suspended', permissions: [] } })
      ]
    });

    await waitFor(
      () => {
        expect(mockReplace).toHaveBeenCalledWith('/dashboard/merchants/m-1/stores/s-1');
      },
      { timeout: 1000 }
    );
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('never infers a legacy store entry when zero enterable workspaces exist, even with exactly one active legacy store', async () => {
    mockApi.getStores.mockResolvedValue({
      items: [
        {
          id: 'st-active',
          merchant_id: 'm-1',
          name: 'Legacy Active Store',
          slug: 'legacy-active',
          status: 'active',
          currency: 'SAR'
        }
      ]
    });
    await renderWith({ contract_version: 'merchant-console/v1', workspaces: [] });

    expect(mockReplace).toHaveBeenCalledWith('/dashboard/onboarding');
    expect(mockReplace).not.toHaveBeenCalledWith('/dashboard/stores/st-active');
    expect(mockPush).not.toHaveBeenCalledWith('/dashboard/stores/st-active');
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('direct-enter requires exactly one active legacy store rather than any single store', async () => {
    mockApi.getStores.mockResolvedValue({ items: [{ id: 'st-draft', status: 'draft', name: 'Draft', slug: 'st-draft' }] });
    await renderWith({ contract_version: 'merchant-console/v1', workspaces: [] });

    expect(mockReplace).not.toHaveBeenCalledWith('/dashboard/stores/st-draft');
    expect(mockReplace).toHaveBeenCalledWith('/dashboard/onboarding');
  });
});
  beforeEach(() => {
    vi.clearAllMocks();
    fetchConsole.mockResolvedValue({
      contract_version: 'merchant-console/v1',
      selected_merchant_id: '',
      workspaces: []
    } as any);
  });

describe('Dashboard Overview Null Safety & Zero Data (T010-T012)', () => {
  it('DashboardOverview handles null items payload without throwing TypeError', async () => {
    // Simulates API returning null or object without items array
    mockApi.getStores.mockResolvedValue(null as any);

    await renderPage(<DashboardOverview />);

    await waitFor(
      () => {
        expect(mockReplace).toHaveBeenCalledWith('/dashboard/onboarding');
      },
      { timeout: 1000 }
    );
  });

  it('StoreOverviewPage renders clean zero-state when all store arrays are empty', async () => {
    mockApi.getStores.mockResolvedValue({
      items: [
        {
          id: 'str_empty',
          merchant_id: 'm_1',
          name: 'Empty Boutique',
          slug: 'empty-boutique',
          status: 'active',
          currency: 'SAR',
          created_at: '2026-10-06T00:00:00Z',
          updated_at: '2026-10-06T00:00:00Z'
        }
      ]
    });
    mockApi.listStoreProducts.mockResolvedValue({ items: [] });
    mockApi.listStoreListings.mockResolvedValue({ items: [] });
    mockApi.listStoreInventory.mockResolvedValue({ items: [] });
    mockApi.listStoreOrders.mockResolvedValue({ orders: [], total: 0 });
    mockApi.getStoreBalance.mockResolvedValue({
      available_minor: 0,
      pending_minor: 0,
      currency: 'SAR',
      updated_at: '2026-10-06T00:00:00Z'
    });
    mockApi.listStoreConnections.mockResolvedValue({ items: [] });
    mockApi.getStoreOperationalState.mockResolvedValue({ checkout_status: 'accepting' });
    mockApi.getThemeInstallation.mockResolvedValue(null);
    mockApi.getStorefrontHost.mockResolvedValue({ host: 'empty.example.com' });

    await renderPage(
      <StoreOverviewPage params={Promise.resolve({ store_id: 'str_empty' })} />
    );

    await waitFor(() => {
      expect(screen.getByText('Empty Boutique')).toBeInTheDocument();
      expect(screen.getByText('0 products / 0 live')).toBeInTheDocument();
      expect(screen.getByText('No recent orders found for this store.')).toBeInTheDocument();
      expect(screen.getByText('No low stock SKUs.')).toBeInTheDocument();
      expect(screen.getByText('No channels connected.')).toBeInTheDocument();
    });
  });
});
