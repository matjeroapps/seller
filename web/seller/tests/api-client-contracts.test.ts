import { describe, expect, it, vi, beforeEach } from 'vitest';
import { sellerClient } from '../lib/api/client';

describe('Seller API Client Contracts & Envelope Integrity (T013)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches seller profile correctly via getProfile', async () => {
    const mockProfile = {
      seller: {
        id: 'sel_a',
        code: 'seller-a',
        name: 'Seller A',
        status: 'active',
        created_at: '2026-10-05T00:00:00Z',
        updated_at: '2026-10-05T00:00:00Z'
      },
      settings: { phone: '+966500000000' }
    };

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url) => {
      expect(String(url)).toContain('/v1/seller/profile');
      return new Response(JSON.stringify(mockProfile), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const profile = await sellerClient.getProfile();
    expect(profile.id).toBe('sel_a');
    expect(profile.code).toBe('seller-a');
    expect(profile.name).toBe('Seller A');
    expect(profile.status).toBe('active');
    expect(profile.phone).toBe('+966500000000');
  });

  it('updates seller profile via updateProfile', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url, init) => {
      expect(String(url)).toContain('/v1/seller/profile');
      expect(init?.method).toBe('PUT');
      expect(JSON.parse(init?.body as string)).toEqual({
        name: 'New Owner Name',
        status: 'active',
        settings: { phone: '+966500000000' }
      });
      return new Response(JSON.stringify({ status: 'active' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const result = await sellerClient.updateProfile({ name: 'New Owner Name', status: 'active', phone: '+966500000000' });
    expect(result.status).toBe('active');
  });

  it('throws typed error on API failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
      return new Response(JSON.stringify({ error: 'unauthorized', message: 'Token expired' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    });

    await expect(sellerClient.getProfile()).rejects.toThrow('Token expired');
  });

  it('normalizes the Core product page into the seller product collection shape', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        products: [
          {
            product: {
              id: 'product-1',
              slug: 'coffee',
              status: 'active',
              created_at: '2026-10-05T00:00:00Z',
              updated_at: '2026-10-05T00:00:00Z'
            },
            source: 'seller_owned',
            name: 'Coffee'
          }
        ],
        total: 1,
        limit: 25,
        offset: 0
      })
    });

    await expect(sellerClient.listStoreProducts('store-1')).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: 'product-1',
          store_id: 'store-1',
          source: 'seller_owned',
          name: 'Coffee',
          status: 'active'
        })
      ]
    });
  });

  it('treats null and legacy collection envelopes as empty collections', async () => {
    const responses = [null, { items: null }];
    global.fetch = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => (String(url).endsWith('/inventory') ? responses[0] : responses[1])
    }));

    await expect(sellerClient.listStoreInventory('store-1')).resolves.toEqual({ items: [] });
    await expect(sellerClient.listStoreListings('store-1')).resolves.toEqual({ items: [] });
  });

  it('normalizes store media assets envelope returned by the seller BFF', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        assets: [
          {
            id: 'asset-1',
            store_id: 'store-1',
            checksum_sha256: 'abc',
            content_type: 'image/png',
            byte_size: 68,
            original_filename: 'matjerhub-upload-test.png',
            status: 'ready',
            url: 'http://localhost:9000/matjero-staging-media/object.png',
            created_at: '2026-10-06T00:00:00Z',
            updated_at: '2026-10-06T00:00:00Z'
          }
        ],
        total: 1,
        limit: 25,
        offset: 0
      })
    });

    await expect(sellerClient.listStoreMedia('store-1')).resolves.toEqual({
      items: [expect.objectContaining({ id: 'asset-1', original_filename: 'matjerhub-upload-test.png' })]
    });
  });
});
