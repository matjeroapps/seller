'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  Boxes,
  CheckCircle2,
  CirclePause,
  ExternalLink,
  Package,
  PackagePlus,
  PlugZap,
  RefreshCw,
  ShoppingBag,
  Store as StoreIcon,
  Truck
} from 'lucide-react';

import { sellerApi } from '@/lib/api/client';
import {
  buildDashboardModel,
  formatCompactNumber,
  formatMinorMoney,
  type DashboardUnavailableSection
} from '@/lib/dashboard-model';
import type {
  IntegrationConnection,
  InventorySnapshot,
  Product,
  SellerListing,
  SellerOrder,
  Store,
  StoreBalance,
  StoreOperationalState,
  ThemeInstallation,
  ThemeInstallationResponse
} from '@/lib/api/types';

type DashboardState = {
  stores: Store[];
  products: Product[];
  listings: SellerListing[];
  inventory: InventorySnapshot[];
  orders: SellerOrder[];
  orderTotal: number;
  balance: StoreBalance | null;
  connections: IntegrationConnection[];
  operationalState: StoreOperationalState | null;
  themeInstallation: ThemeInstallation | null;
  themeRevision: Pick<ThemeInstallationResponse, 'draft_revision' | 'published_revision'> | null;
  storefrontHost: string;
  unavailable: DashboardUnavailableSection[];
};

const emptyState: DashboardState = {
  stores: [],
  products: [],
  listings: [],
  inventory: [],
  orders: [],
  orderTotal: 0,
  balance: null,
  connections: [],
  operationalState: null,
  themeInstallation: null,
  themeRevision: null,
  storefrontHost: '',
  unavailable: []
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Dashboard data could not be loaded.';
}

function statusLabel(value?: string) {
  return value ? value.replace(/[_-]/g, ' ') : 'Unknown';
}

function storefrontUrl(host?: string) {
  if (!host) return undefined;

  return host.startsWith('http') ? host : `https://${host}`;
}

function formatRelativeDate(value?: string) {
  if (!value) return 'Not updated';

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

export default function StoreOverviewPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = use(params);
  const [dashboard, setDashboard] = useState<DashboardState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingAction, setUpdatingAction] = useState<'status' | 'checkout' | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setLoading(true);
      setFatalError(null);

      const storesResult = await sellerApi.getStores().catch((error: unknown) => {
        throw new Error(getErrorMessage(error));
      });

      const [
        productsResult,
        listingsResult,
        inventoryResult,
        ordersResult,
        balanceResult,
        connectionsResult,
        operationalStateResult,
        themeResult,
        hostResult
      ] = await Promise.allSettled([
        sellerApi.listStoreProducts(store_id),
        sellerApi.listStoreListings(store_id),
        sellerApi.listStoreInventory(store_id),
        sellerApi.listStoreOrders(store_id, { limit: 8 }),
        sellerApi.getStoreBalance(store_id),
        sellerApi.listStoreConnections(store_id),
        sellerApi.getStoreOperationalState(store_id),
        sellerApi.getThemeInstallation(store_id),
        sellerApi.getStorefrontHost(store_id)
      ]);

      if (!isMounted) return;

      const unavailable: DashboardUnavailableSection[] = [];
      const getValue = <T,>(section: DashboardUnavailableSection, result: PromiseSettledResult<T>, fallback: T): T => {
        if (result.status === 'fulfilled') return result.value;
        unavailable.push(section);
        return fallback;
      };

      const themeResponse = getValue<ThemeInstallationResponse | null>('theme', themeResult, null);
      const ordersResponse = getValue('orders', ordersResult, { orders: [], total: 0, limit: 8, offset: 0 });

      setDashboard({
        stores: storesResult?.items || [],
        products: getValue('products', productsResult, { items: [] })?.items || [],
        listings: getValue('listings', listingsResult, { items: [] })?.items || [],
        inventory: getValue('inventory', inventoryResult, { items: [] })?.items || [],
        orders: ordersResponse?.orders || [],
        orderTotal: ordersResponse?.total || 0,
        balance: getValue<StoreBalance | null>('finance', balanceResult, null),
        connections: getValue('integrations', connectionsResult, { items: [] })?.items || [],
        operationalState: getValue<StoreOperationalState | null>('operational-state', operationalStateResult, null),
        themeInstallation: themeResponse?.installation || null,
        themeRevision: themeResponse
          ? { draft_revision: themeResponse.draft_revision, published_revision: themeResponse.published_revision }
          : null,
        storefrontHost: getValue('storefront', hostResult, { host: '' }).host || '',
        unavailable
      });
      setLoading(false);
    }

    loadDashboard().catch((error: unknown) => {
      if (!isMounted) return;
      setFatalError(getErrorMessage(error));
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [reloadKey, store_id]);

  const currentStore = dashboard.stores.find((store) => store.id === store_id);
  const model = useMemo(
    () =>
      buildDashboardModel({
        store: currentStore,
        products: dashboard.products,
        listings: dashboard.listings,
        inventory: dashboard.inventory,
        orders: dashboard.orders,
        orderTotal: dashboard.orderTotal,
        balance: dashboard.balance,
        connections: dashboard.connections,
        operationalState: dashboard.operationalState,
        themeInstallation: dashboard.themeInstallation,
        themeRevision: dashboard.themeRevision,
        storefrontHost: dashboard.storefrontHost,
        unavailable: dashboard.unavailable
      }),
    [currentStore, dashboard]
  );

  const basePath = `/dashboard/stores/${store_id}`;
  const publicStorefrontUrl = storefrontUrl(dashboard.storefrontHost);

  const handleStatusChange = async (newStatus: Store['status']) => {
    if (!currentStore) return;

    setUpdatingAction('status');
    setActionError(null);
    try {
      const updated = await sellerApi.updateStoreStatus(store_id, newStatus);
      setDashboard((previous) => ({
        ...previous,
        stores: previous.stores.map((store) => (store.id === store_id ? updated : store))
      }));
    } catch (error: unknown) {
      setActionError(getErrorMessage(error));
    } finally {
      setUpdatingAction(null);
    }
  };

  const handleCheckoutToggle = async () => {
    setUpdatingAction('checkout');
    setActionError(null);
    try {
      const nextStatus = model.checkoutAccepting ? 'paused' : 'accepting';
      const updated = await sellerApi.updateStoreOperationalState(store_id, { checkout_status: nextStatus });
      setDashboard((previous) => ({ ...previous, operationalState: updated }));
    } catch (error: unknown) {
      setActionError(getErrorMessage(error));
    } finally {
      setUpdatingAction(null);
    }
  };

  if (loading) {
    return (
      <div className="seller-dashboard seller-dashboard--loading" aria-busy="true">
        <div className="seller-skeleton seller-skeleton--hero" />
        <div className="seller-dashboard__kpis">
          {[0, 1, 2, 3].map((item) => (
            <div className="seller-skeleton seller-skeleton--card" key={item} />
          ))}
        </div>
      </div>
    );
  }

  if (fatalError) {
    return (
      <div className="seller-dashboard">
        <div className="seller-empty-state">
          <AlertTriangle aria-hidden="true" />
          <h1>Seller dashboard is unavailable</h1>
          <p>{fatalError}</p>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)}>
            <RefreshCw aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="seller-dashboard">
      {actionError && (
        <div className="seller-alert seller-alert--danger" role="alert">
          <AlertTriangle aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      {dashboard.unavailable.length > 0 && (
        <div className="seller-alert seller-alert--warning" role="status">
          <AlertTriangle aria-hidden="true" />
          <span>Some operational sections are temporarily unavailable: {dashboard.unavailable.join(', ')}.</span>
        </div>
      )}

      <section className="seller-dashboard-hero">
        <div>
          <div className="seller-dashboard-hero__eyebrow">
            <StoreIcon aria-hidden="true" />
            <span>{currentStore?.code || store_id}</span>
          </div>
          <div className="seller-dashboard-hero__title-row">
            <h1>{currentStore?.name || 'Store Dashboard'}</h1>
            <span className={`seller-status-badge seller-status-badge--${currentStore?.status || 'neutral'}`}>
              {statusLabel(currentStore?.status)}
            </span>
          </div>
          <div className="seller-dashboard-hero__meta">
            <span>Market {currentStore?.market_code || 'SA'}</span>
            <span>{model.currency}</span>
            <span>{dashboard.storefrontHost || 'Storefront host pending'}</span>
            <span>{model.checkoutAccepting ? 'Checkout accepting orders' : 'Checkout paused'}</span>
          </div>
        </div>

        <div className="seller-dashboard-hero__actions">
          <button type="button" onClick={handleCheckoutToggle} disabled={updatingAction === 'checkout'}>
            <CirclePause aria-hidden="true" />
            {updatingAction === 'checkout' ? 'Updating...' : model.checkoutAccepting ? 'Pause checkout' : 'Resume checkout'}
          </button>
          {currentStore?.status === 'active' ? (
            <button type="button" onClick={() => handleStatusChange('inactive')} disabled={updatingAction === 'status'}>
              {updatingAction === 'status' ? 'Updating...' : 'Deactivate store'}
            </button>
          ) : (
            <button type="button" onClick={() => handleStatusChange('active')} disabled={updatingAction === 'status'}>
              {updatingAction === 'status' ? 'Updating...' : 'Activate store'}
            </button>
          )}
          <Link className="seller-primary-action" href={`${basePath}/catalog/products/new`}>
            <PackagePlus aria-hidden="true" />
            Add product
          </Link>
          {publicStorefrontUrl && (
            <a className="seller-secondary-link" href={publicStorefrontUrl} target="_blank" rel="noreferrer">
              Visit storefront
              <ExternalLink aria-hidden="true" />
            </a>
          )}
        </div>
      </section>

      <section className="seller-dashboard__kpis" aria-label="Store performance summary">
        <Link href={`${basePath}/catalog/products`} className="seller-kpi-card">
          <span className="seller-kpi-card__icon seller-kpi-card__icon--blue">
            <Package aria-hidden="true" />
          </span>
          <span className="seller-kpi-card__label">Products</span>
          <strong>{formatCompactNumber(dashboard.products.length)}</strong>
          <span>{model.activeProducts} active</span>
        </Link>
        <Link href={`${basePath}/orders`} className="seller-kpi-card">
          <span className="seller-kpi-card__icon seller-kpi-card__icon--green">
            <ShoppingBag aria-hidden="true" />
          </span>
          <span className="seller-kpi-card__label">Orders</span>
          <strong>{dashboard.unavailable.includes('orders') ? 'Unavailable' : formatCompactNumber(model.totalOrders)}</strong>
          <span>{model.pendingOrders.length} waiting</span>
        </Link>
        <Link href={`${basePath}/catalog/listings`} className="seller-kpi-card">
          <span className="seller-kpi-card__icon seller-kpi-card__icon--teal">
            <Activity aria-hidden="true" />
          </span>
          <span className="seller-kpi-card__label">Published listings</span>
          <strong>{model.publishedListings}</strong>
          <span>{model.draftListings + model.unpublishedListings} not live</span>
        </Link>
        <Link href={`${basePath}/finance`} className="seller-kpi-card">
          <span className="seller-kpi-card__icon seller-kpi-card__icon--amber">
            <Banknote aria-hidden="true" />
          </span>
          <span className="seller-kpi-card__label">Available payout</span>
          <strong>{dashboard.balance ? formatMinorMoney(dashboard.balance.available_minor, dashboard.balance.currency) : 'Unavailable'}</strong>
          <span>{dashboard.balance ? `${formatMinorMoney(dashboard.balance.pending_minor, dashboard.balance.currency)} pending` : 'Finance API offline'}</span>
        </Link>
      </section>

      <div className="seller-dashboard__grid">
        <div className="seller-dashboard__main">
          <section className="seller-panel seller-panel--attention">
            <div className="seller-panel__header">
              <div>
                <span className="seller-section-kicker">Attention center</span>
                <h2>What needs a seller decision</h2>
              </div>
              <button type="button" onClick={() => setReloadKey((value) => value + 1)}>
                <RefreshCw aria-hidden="true" />
                Refresh
              </button>
            </div>
            <div className="seller-attention-grid">
              {model.attentionItems.map((item) => (
                <Link key={item.id} href={`${basePath}/${item.href}`} className={`seller-attention-card seller-attention-card--${item.tone}`}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>

          <section className="seller-panel seller-operations-panel">
            <div className="seller-panel__header">
              <div>
                <span className="seller-section-kicker">Operations</span>
                <h2>Store readiness and flow</h2>
              </div>
              <span className="seller-readiness-pill">{model.completedLaunchTasks}/{model.totalLaunchTasks} tasks ready</span>
            </div>
            <div className="seller-readiness-meter" aria-label={`Launch readiness ${model.readinessPercent}%`}>
              <span style={{ inlineSize: `${model.readinessPercent}%` }} />
            </div>
            <div className="seller-operations-list">
              <div>
                <CheckCircle2 aria-hidden="true" />
                <span>Products and listings</span>
                <strong>{dashboard.products.length} products / {model.publishedListings} live</strong>
              </div>
              <div>
                <CheckCircle2 aria-hidden="true" />
                <span>Theme status</span>
                <strong>{model.themeNeedsPublish ? 'Draft changes pending' : dashboard.themeInstallation ? 'Published' : 'Not installed'}</strong>
              </div>
              <div>
                <CheckCircle2 aria-hidden="true" />
                <span>Checkout state</span>
                <strong>{model.checkoutAccepting ? 'Accepting orders' : 'Paused'}</strong>
              </div>
            </div>
          </section>

          <section className="seller-panel">
            <div className="seller-panel__header">
              <div>
                <span className="seller-section-kicker">Recent orders</span>
                <h2>Latest storefront demand</h2>
              </div>
              <Link href={`${basePath}/orders`}>View all</Link>
            </div>
            {dashboard.orders.length === 0 ? (
              <div className="seller-inline-empty">No recent orders found for this store.</div>
            ) : (
              <div className="seller-orders-table">
                {dashboard.orders.map((order) => (
                  <Link href={`${basePath}/orders/${order.id}`} key={order.id} className="seller-orders-row">
                    <span>
                      <strong>{order.order_number}</strong>
                      <small>{order.recipient_name || 'Guest customer'}</small>
                    </span>
                    <span>{statusLabel(order.status)}</span>
                    <span>{order.item_count} items</span>
                    <span>{formatMinorMoney(order.total, order.currency)}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="seller-dashboard__rail">
          <section className="seller-panel">
            <div className="seller-panel__header">
              <div>
                <span className="seller-section-kicker">Quick actions</span>
                <h2>Daily seller tasks</h2>
              </div>
            </div>
            <div className="seller-quick-actions">
              <Link href={`${basePath}/catalog/products/new`}>
                <PackagePlus aria-hidden="true" />
                Create product
              </Link>
              <Link href={`${basePath}/catalog/supplier-offers`}>
                <Truck aria-hidden="true" />
                Import supplier offer
              </Link>
              <Link href={`${basePath}/inventory`}>
                <Boxes aria-hidden="true" />
                Adjust inventory
              </Link>
              <Link href={`${basePath}/integrations`}>
                <PlugZap aria-hidden="true" />
                Connect channel
              </Link>
            </div>
          </section>

          <section className="seller-panel">
            <div className="seller-panel__header">
              <div>
                <span className="seller-section-kicker">Stock alerts</span>
                <h2>Inventory at risk</h2>
              </div>
            </div>
            {model.lowStockItems.length === 0 ? (
              <div className="seller-inline-empty">No low stock SKUs.</div>
            ) : (
              <div className="seller-rail-list">
                {model.lowStockItems.map((item) => (
                  <Link href={`${basePath}/inventory`} key={item.id}>
                    <span>
                      <strong>{item.sku_code || item.sku_id}</strong>
                      <small>{item.location_name || 'Primary location'}</small>
                    </span>
                    <em>{item.available_qty}</em>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="seller-panel">
            <div className="seller-panel__header">
              <div>
                <span className="seller-section-kicker">Connected channels</span>
                <h2>Sales surfaces</h2>
              </div>
            </div>
            <div className="seller-channel-stack">
              {dashboard.connections.length === 0 ? (
                <div className="seller-inline-empty">No channels connected.</div>
              ) : (
                dashboard.connections.slice(0, 4).map((connection) => (
                  <Link href={`${basePath}/integrations`} key={connection.id}>
                    <span>
                      <strong>{connection.name}</strong>
                      <small>{connection.provider}</small>
                    </span>
                    <em className={`seller-channel-status seller-channel-status--${connection.status}`}>{statusLabel(connection.status)}</em>
                  </Link>
                ))
              )}
            </div>
          </section>

          <section className="seller-panel seller-ledger-card">
            <div className="seller-panel__header">
              <div>
                <span className="seller-section-kicker">Settlement ledger</span>
                <h2>Balance snapshot</h2>
              </div>
            </div>
            <strong>{dashboard.balance ? formatMinorMoney(dashboard.balance.available_minor, dashboard.balance.currency) : 'Unavailable'}</strong>
            <span>Updated {formatRelativeDate(dashboard.balance?.updated_at)}</span>
            <Link href={`${basePath}/finance`}>
              Open finance
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
