import { describe, expect, it } from 'vitest';

import { buildDashboardModel, formatMinorMoney, getLowStockItems } from '../lib/dashboard-model';
import type { InventorySnapshot, SellerListing, SellerOrder } from '../lib/api/types';

const inventory = (id: string, available_qty: number): InventorySnapshot => ({
  id,
  fulfillment_location_id: 'loc_1',
  sku_id: `sku_${id}`,
  sku_code: `SKU-${id}`,
  on_hand_qty: available_qty,
  reserved_qty: 0,
  available_qty,
  version: 1,
  updated_at: '2026-10-01T10:00:00Z'
});

const order = (id: string, status: string): SellerOrder => ({
  id,
  order_number: `ORD-${id}`,
  status,
  currency: 'SAR',
  total: 2500,
  item_count: 1,
  recipient_name: 'Test Customer',
  created_at: '2026-10-01T10:00:00Z'
});

describe('dashboard model', () => {
  it('formats minor-unit money for seller finance values', () => {
    expect(formatMinorMoney(12345, 'SAR')).toBe('SAR\u00a0123.45');
    expect(formatMinorMoney(12000, 'SAR')).toBe('SAR\u00a0120');
  });

  it('sorts low stock inventory by urgency and caps the rail list', () => {
    expect(getLowStockItems([inventory('a', 9), inventory('b', 0), inventory('c', 3), inventory('d', 5)]).map((item) => item.id)).toEqual([
      'b',
      'c',
      'd'
    ]);
  });

  it('derives operational attention from source-backed sections', () => {
    const listings: SellerListing[] = [
      {
        id: 'listing_1',
        store_id: 'store_1',
        product_id: 'product_1',
        market_code: 'SA',
        status: 'published',
        created_at: '2026-10-01T10:00:00Z',
        updated_at: '2026-10-01T10:00:00Z'
      },
      {
        id: 'listing_2',
        store_id: 'store_1',
        product_id: 'product_2',
        market_code: 'SA',
        status: 'draft',
        created_at: '2026-10-01T10:00:00Z',
        updated_at: '2026-10-01T10:00:00Z'
      }
    ];

    const model = buildDashboardModel({
      store: {
        id: 'store_1',
        seller_id: 'seller_1',
        market_code: 'SA',
        code: 'demo-store',
        name: 'Demo Store',
        status: 'active',
        created_at: '2026-10-01T10:00:00Z',
        updated_at: '2026-10-01T10:00:00Z'
      },
      products: [
        {
          id: 'product_1',
          source: 'seller_owned',
          slug: 'demo-product',
          name: 'Demo Product',
          status: 'active',
          created_at: '2026-10-01T10:00:00Z',
          updated_at: '2026-10-01T10:00:00Z'
        }
      ],
      listings,
      inventory: [inventory('low', 1)],
      orders: [order('1', 'pending'), order('2', 'delivered')],
      orderTotal: 12,
      balance: { available_minor: 30000, pending_minor: 12000, currency: 'SAR', updated_at: '2026-10-01T10:00:00Z' },
      connections: [{ id: 'conn_1', actor_type: 'store', actor_id: 'store_1', provider: 'shopify', name: 'Shopify', status: 'error', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z' }],
      storefrontHost: 'demo.matjerhub.test',
      operationalState: { store_id: 'store_1', checkout_status: 'accepting', maintenance_message: '', checkout_accepting: true },
      themeInstallation: { id: 'theme_1', store_id: 'store_1', theme_key: 'modern', version: '1.0.0', status: 'active' },
      themeRevision: { draft_revision: 3, published_revision: 2 },
      unavailable: []
    });

    expect(model.publishedListings).toBe(1);
    expect(model.pendingOrders).toHaveLength(1);
    expect(model.lowStockItems).toHaveLength(1);
    expect(model.channelIssues).toHaveLength(1);
    expect(model.themeNeedsPublish).toBe(true);
    expect(model.readinessPercent).toBe(100);
  });
});
