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
import { useTranslation } from '@/lib/i18n/locale-context';
import { storefrontUrlForHost } from '@/lib/storefront-url';
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

function errMessageOf(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

// Formats an authoritative server status enum for display; known statuses are
// localized, any other server status is shown verbatim without translation.
function formatStatusLabel(value?: string) {
  return value ? value.replace(/[_-]/g, ' ') : '';
}

function storefrontUrl(host?: string) {
  return storefrontUrlForHost(host);
}

function formatTimestamp(value?: string) {
  if (!value) return undefined;

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatTemplate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values[key] ?? ''));
}

export default function StoreOverviewPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = use(params);
  const { t } = useTranslation();
  const localizedStatusLabel = (value?: string) => {
    if (!value) return t('storeOverview.unknownStatus', 'Unknown');
    return t(`statuses.${value.replace(/[_-]/g, '_').toLowerCase()}`, formatStatusLabel(value));
  };
  const errMessage = (error: unknown) =>
    errMessageOf(error, t('storeOverview.loadFailed', 'Dashboard data could not be loaded.'));
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
        throw new Error(errMessage(error));
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
      function getValue<T>(section: DashboardUnavailableSection, result: PromiseSettledResult<T>, fallback: T): T {
        if (result.status === 'fulfilled') return result.value;
        unavailable.push(section);
        return fallback;
      }

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
      setFatalError(errMessage(error));
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
  const hasBalanceCurrency = Boolean(dashboard.balance?.currency?.trim());
  const availablePayoutLabel = dashboard.balance && hasBalanceCurrency ? formatMinorMoney(dashboard.balance.available_minor, dashboard.balance.currency) : t('common.unavailable', 'Unavailable');
  const pendingPayoutLabel = dashboard.balance && hasBalanceCurrency ? `${formatMinorMoney(dashboard.balance.pending_minor, dashboard.balance.currency)} ${t('storeOverview.payoutPendingSuffix', 'pending')}` : t('storeOverview.financeUnavailable', 'Finance data unavailable');

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
      setActionError(errMessage(error));
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
      setActionError(errMessage(error));
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
          <h1>{t('storeOverview.unavailableTitle', 'Seller dashboard is unavailable')}</h1>
          <p>{fatalError}</p>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)}>
            <RefreshCw aria-hidden="true" />
            {t('storeOverview.retry', 'Retry')}
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
          <span>
            {formatTemplate(t('storeOverview.sectionsUnavailable', 'Some operational sections are temporarily unavailable: {{sections}}.'), { sections: dashboard.unavailable.join(', ') })}
          </span>
        </div>
      )}

      <section className="seller-dashboard-hero">
        <div>
          <div className="seller-dashboard-hero__eyebrow">
            <StoreIcon aria-hidden="true" />
            <span>{currentStore?.code || store_id}</span>
          </div>
          <div className="seller-dashboard-hero__title-row">
            <h1>{currentStore?.name || t('storeOverview.dashboardTitle', 'Store Dashboard')}</h1>
            <span className={`seller-status-badge seller-status-badge--${currentStore?.status || 'neutral'}`}>
              {localizedStatusLabel(currentStore?.status)}
            </span>
          </div>
          <div className="seller-dashboard-hero__meta">
            <span>{t('storeOverview.marketLabel', 'Market')} {currentStore?.market_code || 'SA'}</span>
            <span>{model.currency}</span>
            <span>{dashboard.storefrontHost || t('storeOverview.storefrontHostPending', 'Storefront host pending')}</span>
            <span>{model.checkoutAccepting ? t('storeOverview.checkoutAccepting', 'Checkout accepting orders') : t('storeOverview.checkoutPaused', 'Checkout paused')}</span>
          </div>
        </div>

        <div className="seller-dashboard-hero__actions">
          <button type="button" onClick={handleCheckoutToggle} disabled={updatingAction === 'checkout'}>
            <CirclePause aria-hidden="true" />
            {updatingAction === 'checkout'
              ? t('storeOverview.updating', 'Updating...')
              : model.checkoutAccepting
                ? t('storeOverview.pauseCheckout', 'Pause checkout')
                : t('storeOverview.resumeCheckout', 'Resume checkout')}
          </button>
          {currentStore?.status === 'active' ? (
            <button type="button" onClick={() => handleStatusChange('inactive')} disabled={updatingAction === 'status'}>
              {updatingAction === 'status' ? t('storeOverview.updating', 'Updating...') : t('storeOverview.deactivateStore', 'Deactivate store')}
            </button>
          ) : (
            <button type="button" onClick={() => handleStatusChange('active')} disabled={updatingAction === 'status'}>
              {updatingAction === 'status' ? t('storeOverview.updating', 'Updating...') : t('storeOverview.activateStore', 'Activate store')}
            </button>
          )}
          <Link className="seller-primary-action" href={`${basePath}/catalog/products/new`}>
            <PackagePlus aria-hidden="true" />
            {t('storeOverview.addProduct', 'Add product')}
          </Link>
          {publicStorefrontUrl && (
            <a className="seller-secondary-link" href={publicStorefrontUrl} target="_blank" rel="noreferrer">
              {t('storeOverview.visitStorefront', 'Visit storefront')}
              <ExternalLink aria-hidden="true" />
            </a>
          )}
        </div>
      </section>

      <section className="seller-dashboard__kpis" aria-label={t('storeOverview.performanceSummaryAria', 'Store performance summary')}>
        <Link href={`${basePath}/catalog/products`} className="seller-kpi-card">
          <span className="seller-kpi-card__icon seller-kpi-card__icon--blue">
            <Package aria-hidden="true" />
          </span>
          <span className="seller-kpi-card__label">{t('storeOverview.kpiProducts', 'Products')}</span>
          <strong>{formatCompactNumber(dashboard.products.length)}</strong>
          <span>{model.activeProducts} {t('storeOverview.activeSuffix', 'active')}</span>
        </Link>
        <Link href={`${basePath}/orders`} className="seller-kpi-card">
          <span className="seller-kpi-card__icon seller-kpi-card__icon--green">
            <ShoppingBag aria-hidden="true" />
          </span>
          <span className="seller-kpi-card__label">{t('storeOverview.kpiOrders', 'Orders')}</span>
          <strong>{dashboard.unavailable.includes('orders') ? t('common.unavailable', 'Unavailable') : formatCompactNumber(model.totalOrders)}</strong>
          <span>{model.pendingOrders.length} {t('storeOverview.waitingSuffix', 'waiting')}</span>
        </Link>
        <Link href={`${basePath}/catalog/listings`} className="seller-kpi-card">
          <span className="seller-kpi-card__icon seller-kpi-card__icon--teal">
            <Activity aria-hidden="true" />
          </span>
          <span className="seller-kpi-card__label">{t('storeOverview.kpiPublishedListings', 'Published listings')}</span>
          <strong>{model.publishedListings}</strong>
          <span>{model.draftListings + model.unpublishedListings} {t('storeOverview.notLiveSuffix', 'not live')}</span>
        </Link>
        <Link href={`${basePath}/finance`} className="seller-kpi-card">
          <span className="seller-kpi-card__icon seller-kpi-card__icon--amber">
            <Banknote aria-hidden="true" />
          </span>
          <span className="seller-kpi-card__label">{t('storeOverview.kpiAvailablePayout', 'Available payout')}</span>
          <strong>{availablePayoutLabel}</strong>
          <span>{pendingPayoutLabel}</span>
        </Link>
      </section>

      <div className="seller-dashboard__grid">
        <div className="seller-dashboard__main">
          <section className="seller-panel seller-panel--attention">
            <div className="seller-panel__header">
              <div>
                <span className="seller-section-kicker">{t('storeOverview.attentionKicker', 'Attention center')}</span>
                <h2>{t('storeOverview.attentionTitle', 'What needs a seller decision')}</h2>
              </div>
              <button type="button" onClick={() => setReloadKey((value) => value + 1)}>
                <RefreshCw aria-hidden="true" />
                {t('common.refresh', 'Refresh')}
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
                <span className="seller-section-kicker">{t('storeOverview.operationsKicker', 'Operations')}</span>
                <h2>{t('storeOverview.operationsTitle', 'Store readiness and flow')}</h2>
              </div>
              <span className="seller-readiness-pill">{`${model.completedLaunchTasks}/${model.totalLaunchTasks} ${t('storeOverview.tasksReady', 'tasks ready')}`}</span>
            </div>
            <div className="seller-readiness-meter" aria-label={formatTemplate(t('storeOverview.launchReadinessAria', 'Launch readiness {{percent}}%'), { percent: model.readinessPercent })}>
              <span style={{ inlineSize: `${model.readinessPercent}%` }} />
            </div>
            <div className="seller-operations-list">
              <div>
                <CheckCircle2 aria-hidden="true" />
                <span>{t('storeOverview.opsProductsListings', 'Products and listings')}</span>
                <strong>{formatTemplate(t('storeOverview.opsProductsListingsValue', '{{products}} products / {{listings}} live'), { products: dashboard.products.length, listings: model.publishedListings })}</strong>
              </div>
              <div>
                <CheckCircle2 aria-hidden="true" />
                <span>{t('storeOverview.opsThemeStatus', 'Theme status')}</span>
                <strong>{model.themeNeedsPublish ? t('storeOverview.themeDraftPending', 'Draft changes pending') : dashboard.themeInstallation ? t('storeOverview.themePublished', 'Published') : t('storeOverview.themeNotInstalled', 'Not installed')}</strong>
              </div>
              <div>
                <CheckCircle2 aria-hidden="true" />
                <span>{t('storeOverview.opsCheckoutState', 'Checkout state')}</span>
                <strong>{model.checkoutAccepting ? t('storeOverview.opsAccepting', 'Accepting orders') : t('storeOverview.opsPaused', 'Paused')}</strong>
              </div>
            </div>
          </section>

          <section className="seller-panel">
            <div className="seller-panel__header">
              <div>
                <span className="seller-section-kicker">{t('storeOverview.recentOrdersKicker', 'Recent orders')}</span>
                <h2>{t('storeOverview.recentOrdersTitle', 'Latest storefront demand')}</h2>
              </div>
              <Link href={`${basePath}/orders`}>{t('storeOverview.viewAll', 'View all')}</Link>
            </div>
            {dashboard.orders.length === 0 ? (
              <div className="seller-inline-empty">{t('storeOverview.noRecentOrders', 'No recent orders found for this store.')}</div>
            ) : (
              <div className="seller-orders-table">
                {dashboard.orders.map((order) => (
                  <Link href={`${basePath}/orders/${order.id}`} key={order.id} className="seller-orders-row">
                    <span>
                      <strong>{order.order_number}</strong>
                      <small>{order.recipient_name || t('storeOverview.guestCustomer', 'Guest customer')}</small>
                    </span>
                    <span>{localizedStatusLabel(order.status)}</span>
                    <span>{order.item_count} {t('storeOverview.itemsSuffix', 'items')}</span>
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
                <span className="seller-section-kicker">{t('storeOverview.quickActionsKicker', 'Quick actions')}</span>
                <h2>{t('storeOverview.quickActionsTitle', 'Daily seller tasks')}</h2>
              </div>
            </div>
            <div className="seller-quick-actions">
              <Link href={`${basePath}/catalog/products/new`}>
                <PackagePlus aria-hidden="true" />
                {t('storeOverview.createProduct', 'Create product')}
              </Link>
              <Link href={`${basePath}/catalog/supplier-offers`}>
                <Truck aria-hidden="true" />
                {t('storeOverview.importSupplierOffer', 'Import supplier offer')}
              </Link>
              <Link href={`${basePath}/inventory`}>
                <Boxes aria-hidden="true" />
                {t('storeOverview.adjustInventory', 'Adjust inventory')}
              </Link>
              <Link href={`${basePath}/integrations`}>
                <PlugZap aria-hidden="true" />
                {t('storeOverview.connectChannel', 'Connect channel')}
              </Link>
            </div>
          </section>

          <section className="seller-panel">
            <div className="seller-panel__header">
              <div>
                <span className="seller-section-kicker">{t('storeOverview.stockAlertsKicker', 'Stock alerts')}</span>
                <h2>{t('storeOverview.stockAlertsTitle', 'Inventory at risk')}</h2>
              </div>
            </div>
            {model.lowStockItems.length === 0 ? (
              <div className="seller-inline-empty">{t('storeOverview.noLowStock', 'No low stock SKUs.')}</div>
            ) : (
              <div className="seller-rail-list">
                {model.lowStockItems.map((item) => (
                  <Link href={`${basePath}/inventory`} key={item.id}>
                    <span>
                      <strong>{item.sku_code || item.sku_id}</strong>
                      <small>{item.location_name || t('storeOverview.primaryLocation', 'Primary location')}</small>
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
                <span className="seller-section-kicker">{t('storeOverview.channelsKicker', 'Connected channels')}</span>
                <h2>{t('storeOverview.channelsTitle', 'Sales surfaces')}</h2>
              </div>
            </div>
            <div className="seller-channel-stack">
              {dashboard.connections.length === 0 ? (
                <div className="seller-inline-empty">{t('storeOverview.noChannels', 'No channels connected.')}</div>
              ) : (
                dashboard.connections.slice(0, 4).map((connection) => (
                  <Link href={`${basePath}/integrations`} key={connection.id}>
                    <span>
                      <strong>{connection.name}</strong>
                      <small>{connection.provider}</small>
                    </span>
                    <em className={`seller-channel-status seller-channel-status--${connection.status}`}>{localizedStatusLabel(connection.status)}</em>
                  </Link>
                ))
              )}
            </div>
          </section>

          <section className="seller-panel seller-ledger-card">
            <div className="seller-panel__header">
              <div>
                <span className="seller-section-kicker">{t('storeOverview.ledgerKicker', 'Settlement ledger')}</span>
                <h2>{t('storeOverview.ledgerTitle', 'Balance snapshot')}</h2>
              </div>
            </div>
            <strong>{availablePayoutLabel}</strong>
            <span>{t('storeOverview.lastUpdatedPrefix', 'Updated')} {formatTimestamp(dashboard.balance?.updated_at) || t('storeOverview.notUpdated', 'Not updated')}</span>
            <Link href={`${basePath}/finance`}>
              {t('storeOverview.openFinance', 'Open finance')}
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
