import type { Product, ProductMediaReference } from '../../lib/api/types';

const STAMP = '2026-10-07T00:00:00Z';

function inventory(available: number) {
  return {
    total_on_hand: available,
    total_reserved: 0,
    total_available: available,
    locations: []
  };
}

/**
 * Shared catalog fixture (T003): covers every status, both sources,
 * with/without images, with/without stock and price, ready + not-ready
 * readiness. Reused by unit tests; mirror in E2E seeds where needed.
 */
export const catalogProducts: Product[] = [
  {
    id: 'product_head',
    store_id: 'store_123',
    source: 'seller_owned',
    slug: 'head-phone',
    name: 'Head Phone',
    status: 'active',
    listing_status: 'published',
    listing_id: 'listing_head',
    created_at: STAMP,
    updated_at: STAMP,
    current_price: { currency: 'SAR', amount: 19900 },
    inventory_summary: inventory(12),
    publish_readiness: { is_ready: true, reasons: [] },
    primary_media_uri: 'https://cdn.example.test/head-phone.webp',
    media_count: 1
  },
  {
    id: 'product_case',
    store_id: 'store_123',
    source: 'seller_owned',
    slug: 'phone-case',
    name: 'Phone Case',
    status: 'draft',
    created_at: STAMP,
    updated_at: STAMP,
    current_price: null,
    publish_readiness: { is_ready: false, reasons: ['Missing variants'] },
    media_count: 0
  },
  {
    id: 'product_charger',
    store_id: 'store_123',
    source: 'supplier_backed',
    slug: 'fast-charger',
    name: 'Fast Charger',
    status: 'active',
    listing_status: 'unpublished',
    listing_id: 'listing_charger',
    supplier_id: 'supplier_1',
    supplier_code: 'SUP-CHG-01',
    supplier_name: 'Volt Supplies',
    created_at: STAMP,
    updated_at: STAMP,
    current_price: { currency: 'SAR', amount_minor: 8900 },
    inventory_summary: inventory(0),
    publish_readiness: { is_ready: false, reasons: ['Out of stock'] },
    media_count: 0
  },
  {
    id: 'product_cable',
    store_id: 'store_123',
    source: 'supplier_backed',
    slug: 'usb-cable',
    name: 'USB Cable',
    status: 'archived',
    listing_status: 'archived',
    listing_id: 'listing_cable',
    supplier_id: 'supplier_1',
    supplier_code: 'SUP-CAB-02',
    supplier_name: 'Volt Supplies',
    created_at: STAMP,
    updated_at: STAMP,
    current_price: { currency: 'SAR', amount: 2900 },
    inventory_summary: inventory(40),
    publish_readiness: { is_ready: true, reasons: [] },
    media_count: 0
  }
];

export const catalogMediaByProductId: Record<string, string> = {
  product_head: 'https://cdn.example.test/head-phone.webp'
};

export function mediaReferencesFor(productId: string): { items: ProductMediaReference[] } {
  const url = catalogMediaByProductId[productId];
  if (!url) return { items: [] };
  return {
    items: [
      {
        id: `media-${productId}`,
        store_id: 'store_123',
        product_id: productId,
        asset_id: `asset-${productId}`,
        alt_text: productId,
        sort_order: 0,
        is_primary: true,
        url,
        created_at: STAMP
      }
    ]
  };
}

/** E2E seed notes: create one product per status/source combination above
 *  (Head Phone, Phone Case, Fast Charger, USB Cable) in store `str_dev_01`
 *  with matching names/slugs/statuses before running
 *  `seller-catalog-operations.spec.ts`. */
export const catalogE2ESeedNames = catalogProducts.map((p) => p.name);
