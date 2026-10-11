import { ApiError, sellerApi } from '@/lib/api/client';
import type { CreateProductVariantPayload, VariantBatchResult, VariantBatchResultItem } from '@/lib/api/types';
import type { VariantPreviewItem } from './preview';

export interface VariantBatchReviewItem extends VariantPreviewItem {
  result?: VariantBatchResultItem;
}

export async function createVariantBatch(
  storeId: string,
  productId: string,
  items: VariantBatchReviewItem[]
): Promise<VariantBatchResult> {
  const results: VariantBatchResultItem[] = [];
  for (const item of items) {
    if (item.removed) {
      results.push({ client_item_id: item.client_item_id, status: 'skipped' });
      continue;
    }
    if (item.existing) {
      results.push({ client_item_id: item.client_item_id, status: 'already_exists' });
      continue;
    }
    if (item.result && item.result.status !== 'failed') {
      results.push(item.result);
      continue;
    }

    const payload: CreateProductVariantPayload = {
      code: item.variant_code,
      status: 'active',
      sku_code: item.sku_code,
      attribute_values: item.attribute_values,
    };
    try {
      const created = await sellerApi.createProductVariant(
        storeId,
        productId,
        payload,
        variantIdempotencyKey(productId, item.client_item_id)
      );
      results.push({
        client_item_id: item.client_item_id,
        status: 'created',
        variant: created,
        sku: created.sku,
      });
    } catch (error) {
      results.push({
        client_item_id: item.client_item_id,
        status: 'failed',
        error: normalizeBatchError(error),
      });
    }
  }
  return summarizeBatch(results);
}

export async function retryFailedVariantBatch(
  storeId: string,
  productId: string,
  items: VariantBatchReviewItem[]
): Promise<VariantBatchResult> {
  return createVariantBatch(
    storeId,
    productId,
    items.filter((item) => item.result?.status === 'failed')
  );
}

export function variantIdempotencyKey(productId: string, clientItemId: string): string {
  return `product-variant:${productId}:${clientItemId}`;
}

function summarizeBatch(items: VariantBatchResultItem[]): VariantBatchResult {
  return {
    items,
    created_count: items.filter((item) => item.status === 'created').length,
    failed_count: items.filter((item) => item.status === 'failed').length,
  };
}

function normalizeBatchError(error: unknown): { code: string; message: string } {
  if (error instanceof ApiError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    return { code: 'unknown_error', message: error.message };
  }
  return { code: 'unknown_error', message: 'Unable to create variant.' };
}
