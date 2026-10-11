import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, sellerApi } from '../lib/api/client';
import { createVariantBatch, retryFailedVariantBatch, variantIdempotencyKey, type VariantBatchReviewItem } from '../lib/variants/batch';

vi.mock('../lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('../lib/api/client')>('../lib/api/client');
  return {
    ...actual,
    sellerApi: {
      createProductVariant: vi.fn(),
    },
  };
});

function item(id: string, overrides: Partial<VariantBatchReviewItem> = {}): VariantBatchReviewItem {
  return {
    client_item_id: id,
    signature: `attr=${id}`,
    attribute_values: [{ attribute_id: 'attr', attribute_value_id: id }],
    labels: [{ attribute_name: 'Color', value_name: id }],
    variant_code: `VAR-${id}`,
    sku_code: `SKU-${id}`,
    existing: false,
    removed: false,
    ...overrides,
  };
}

describe('variant batch coordinator', () => {
  beforeEach(() => {
    vi.mocked(sellerApi.createProductVariant).mockReset();
  });

  it('returns mixed per-item outcomes and stable idempotency keys', async () => {
    vi.mocked(sellerApi.createProductVariant)
      .mockResolvedValueOnce({ id: 'variant-red', product_id: 'prod', code: 'VAR-red', status: 'active', sku: { id: 'sku-red', variant_id: 'variant-red', code: 'SKU-red', status: 'active', created_at: '', updated_at: '' }, created_at: '', updated_at: '' })
      .mockRejectedValueOnce(new ApiError('conflict', 'SKU code is already used in this store catalog', 409));

    const result = await createVariantBatch('store', 'prod', [
      item('red'),
      item('blue'),
      item('existing', { existing: true }),
      item('removed', { removed: true }),
    ]);

    expect(result.created_count).toBe(1);
    expect(result.failed_count).toBe(1);
    expect(result.items.map((entry) => entry.status)).toEqual(['created', 'failed', 'already_exists', 'skipped']);
    expect(sellerApi.createProductVariant).toHaveBeenNthCalledWith(
      1,
      'store',
      'prod',
      expect.objectContaining({ code: 'VAR-red', sku_code: 'SKU-red' }),
      variantIdempotencyKey('prod', 'red')
    );
  });

  it('retries only failed rows', async () => {
    vi.mocked(sellerApi.createProductVariant).mockResolvedValue({ id: 'variant-blue', product_id: 'prod', code: 'VAR-blue', status: 'active', created_at: '', updated_at: '' });

    const result = await retryFailedVariantBatch('store', 'prod', [
      item('red', { result: { client_item_id: 'red', status: 'created' } }),
      item('blue', { result: { client_item_id: 'blue', status: 'failed', error: { code: 'conflict', message: 'conflict' } } }),
    ]);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ client_item_id: 'blue', status: 'created' });
    expect(sellerApi.createProductVariant).toHaveBeenCalledTimes(1);
  });
});
