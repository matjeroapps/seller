import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';

import { MerchantWorkspaceSwitcher } from '../components/shell/MerchantWorkspaceSwitcher';
import SupplyConnectionsPage from '../app/(dashboard)/dashboard/merchants/[merchant_id]/supply/connections/page';
import SupplyImportBatchesPage from '../app/(dashboard)/dashboard/merchants/[merchant_id]/supply/import-batches/page';
import SupplyMappingsPage from '../app/(dashboard)/dashboard/merchants/[merchant_id]/supply/mappings/page';
import { fetchMerchantConsole, merchantSupplyApi, type MerchantConsoleBootstrap } from '../lib/api/merchant-console';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/dashboard/merchants/m-1',
  useSearchParams: () => new URLSearchParams()
}));

vi.mock('../lib/api/merchant-console', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/api/merchant-console')>();
  return {
    ...original,
    fetchMerchantConsole: vi.fn(),
    merchantSupplyApi: {
      ...original.merchantSupplyApi,
      listConnections: vi.fn(),
      listImportBatches: vi.fn(),
      listReviewCases: vi.fn(),
      listMappings: vi.fn(),
      listCursors: vi.fn(),
      listFulfillmentRequests: vi.fn()
    }
  };
});

const fetchConsole = vi.mocked(fetchMerchantConsole);
const listConnections = vi.mocked(merchantSupplyApi.listConnections);

import type { MerchantWorkspace } from '../lib/api/merchant-console';

const workspace = (overrides: Partial<MerchantWorkspace> = {}): MerchantWorkspace => ({
  merchant_id: 'm-1',
  merchant_code: 'M1',
  legal_name: 'Merchant One',
  merchant_status: 'active' as const,
  membership: { id: 'mem-1', status: 'active', permissions: ['retail.orders.manage'] },
  stores: [],
  ...overrides
});

// The pages consume `use(params)`, which suspends until the params promise
// resolves; rendering is therefore awaited inside act.
async function renderPage(ui: React.ReactElement) {
  let utils: ReturnType<typeof render>;
  await act(async () => {
    utils = render(ui);
  });
  return utils!;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('Supply module screens over live contracts (US4)', () => {
  it('renders a genuine empty state for a merchant with no connections — no sample data', async () => {
    listConnections.mockResolvedValueOnce([]);
    await renderPage(<SupplyConnectionsPage params={Promise.resolve({ merchant_id: 'm-1' })} />);
    const empty = await screen.findByTestId('supply-empty');
    expect(empty).toBeInTheDocument();
    expect(empty.textContent).not.toMatch(/example|sample|demo/i);
    expect(screen.queryByTestId('supply-loading')).not.toBeInTheDocument();
  });

  it('renders real connection state exactly as persisted', async () => {
    listConnections.mockResolvedValueOnce([
      {
        id: 'conn-1',
        merchant_id: 'm-1',
        connection_type: 'SUPPLY_SOURCE',
        provider: 'salla',
        name: 'Main source',
        status: 'ERROR',
        health_status: 'degraded',
        created_at: '2026-10-03T00:00:00Z',
        updated_at: '2026-10-03T00:00:00Z'
      }
    ]);
    await renderPage(<SupplyConnectionsPage params={Promise.resolve({ merchant_id: 'm-1' })} />);
    expect(await screen.findByText('Main source')).toBeInTheDocument();
    expect(screen.getByText('ERROR')).toBeInTheDocument();
    expect(screen.getByText(/health degraded/)).toBeInTheDocument();
  });

  it('renders the denied state when the server denies the supply read', async () => {
    const denied = Object.assign(new Error('forbidden'), { name: 'MerchantConsoleError', status: 403 });
    listConnections.mockRejectedValueOnce(denied);
    await renderPage(<SupplyConnectionsPage params={Promise.resolve({ merchant_id: 'm-1' })} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('renders empty states for import batches and mappings', async () => {
    vi.mocked(merchantSupplyApi.listImportBatches).mockResolvedValueOnce([]);
    await renderPage(<SupplyImportBatchesPage params={Promise.resolve({ merchant_id: 'm-1' })} />);
    expect(await screen.findByTestId('supply-empty')).toBeInTheDocument();

    vi.mocked(merchantSupplyApi.listMappings).mockResolvedValueOnce([]);
    await renderPage(<SupplyMappingsPage params={Promise.resolve({ merchant_id: 'm-2' })} />);
    expect(await screen.findAllByTestId('supply-empty')).toHaveLength(2);
  });
});

describe('Merchant workspace switcher (US3)', () => {
  const onSelect = vi.fn();

  it('does not render for a single accessible workspace', () => {
    render(
      <MerchantWorkspaceSwitcher
        workspaces={[workspace()]}
        selectedMerchantId="m-1"
        onSelect={onSelect}
      />
    );
    expect(screen.queryByTestId('merchant-workspace-switcher')).not.toBeInTheDocument();
  });

  it('renders for multiple operable workspaces and never counts non-operable ones', () => {
    render(
      <MerchantWorkspaceSwitcher
        workspaces={[
          workspace(),
          workspace({ merchant_id: 'm-2', merchant_code: 'M2', legal_name: 'Merchant Two' }),
          workspace({ merchant_id: 'm-3', merchant_code: 'M3', legal_name: 'Suspended Merchant', membership: { id: 'mem-3', status: 'suspended', permissions: [] } })
        ]}
        selectedMerchantId="m-1"
        onSelect={onSelect}
      />
    );
    expect(screen.getByTestId('merchant-workspace-switcher')).toBeInTheDocument();
    expect(screen.queryByText('Suspended Merchant')).not.toBeInTheDocument();
  });
});

