import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchMerchantConsole, MerchantConsoleError } from '../lib/api/merchant-console';

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
