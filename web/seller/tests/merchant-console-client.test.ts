import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchMerchantConsole, merchantSupplyApi, MerchantConsoleError } from '../lib/api/merchant-console';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('merchant console bootstrap client (US1)', () => {
  it('carries the explicitly selected workspace in the URL and never invents one', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ contract_version: '1', workspaces: [] }), { status: 200 }))
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchMerchantConsole('m-9');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/seller/v1/bootstrap?merchant_id=m-9',
      expect.objectContaining({ credentials: 'include' })
    );

    await fetchMerchantConsole();
    expect(fetchMock).toHaveBeenLastCalledWith('/api/seller/v1/bootstrap', expect.anything());
  });

  it('unwraps the Seller bootstrap merchant_console block', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              app: 'Seller API',
              merchant_console: {
                contract_version: '1',
                selected_merchant_id: 'm-1',
                workspaces: [
                  {
                    merchant_id: 'm-1',
                    merchant_code: 'M1',
                    legal_name: 'Merchant One',
                    merchant_status: 'active',
                    membership: { id: 'mem-1', status: 'active', permissions: [] },
                    stores: []
                  }
                ]
              }
            }),
            { status: 200 }
          )
        )
      )
    );

    const bootstrap = await fetchMerchantConsole('m-1');

    expect(bootstrap.selected_merchant_id).toBe('m-1');
    expect(bootstrap.workspaces).toHaveLength(1);
    expect(bootstrap.workspaces[0].merchant_id).toBe('m-1');
  });

  it('surfaces a structured error for denial responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ error: { code: 'merchant_workspace_forbidden' } }), { status: 403 }))
      )
    );
    const error = await fetchMerchantConsole('m-x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MerchantConsoleError);
    expect((error as MerchantConsoleError).status).toBe(403);
  });
});

describe('merchant supply client', () => {
  it('calls Seller API v1 routes through the same-origin proxy', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify([]), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);

    await merchantSupplyApi.listImportBatches('m-1');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/seller/v1/merchants/m-1/integrations/supply/import-batches',
      expect.objectContaining({ credentials: 'include' })
    );
  });
});
