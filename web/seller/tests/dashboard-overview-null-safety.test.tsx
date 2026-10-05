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

describe('Dashboard Overview Null Safety & Zero Data (T010-T012)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchConsole.mockResolvedValue({
      contract_version: 'merchant-console/v1',
      selected_merchant_id: '',
      workspaces: []
    } as any);
  });

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
