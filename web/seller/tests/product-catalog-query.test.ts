import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sellerApi } from '../lib/api/client';

describe('Catalog query API contract (T007)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function mockProductsResponse(body: unknown, onUrl?: (url: string) => void) {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url) => {
      onUrl?.(String(url));
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });
  }

  it('sends query/status/source/limit/offset as URL params', async () => {
    let seenUrl = '';
    mockProductsResponse({ products: [], total: 0, limit: 20, offset: 0 }, (url) => {
      seenUrl = url;
    });

    await sellerApi.listStoreProducts('store_123', {
      query: 'phone',
      status: 'published',
      source: 'seller_owned',
      limit: 20,
      offset: 40
    });

    expect(seenUrl).toContain('/v1/seller/stores/store_123/products?');
    expect(seenUrl).toContain('query=phone');
    expect(seenUrl).toContain('status=published');
    expect(seenUrl).toContain('source=seller_owned');
    expect(seenUrl).toContain('limit=20');
    expect(seenUrl).toContain('offset=40');
  });

  it('omits all-filters and empty query from the URL', async () => {
    let seenUrl = '';
    mockProductsResponse({ products: [], total: 0, limit: 20, offset: 0 }, (url) => {
      seenUrl = url;
    });

    await sellerApi.listStoreProducts('store_123', { query: '  ', status: 'all', source: 'all' });

    expect(seenUrl).toContain('/v1/seller/stores/store_123/products');
    expect(seenUrl).not.toContain('query=');
    expect(seenUrl).not.toContain('status=');
    expect(seenUrl).not.toContain('source=');
  });

  it('returns the server total/limit/offset envelope', async () => {
    mockProductsResponse({
      products: [
        {
          product: { id: 'p1', slug: 'phone', status: 'active', created_at: '', updated_at: '' },
          source: 'seller_owned',
          name: 'Phone',
          listing_status: 'published'
        }
      ],
      total: 42,
      limit: 20,
      offset: 20
    });

    const result = await sellerApi.listStoreProducts('store_123', { limit: 20, offset: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Phone');
    expect(result.total).toBe(42);
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(20);
  });

  it('falls back to page length when the envelope omits totals', async () => {
    mockProductsResponse({
      products: [
        {
          product: { id: 'p1', slug: 'phone', status: 'active', created_at: '', updated_at: '' },
          source: 'seller_owned',
          name: 'Phone'
        }
      ]
    });

    const result = await sellerApi.listStoreProducts('store_123');

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.offset).toBe(0);
  });
});
