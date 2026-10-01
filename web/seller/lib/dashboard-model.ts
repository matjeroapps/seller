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
} from './api/types';

export const LOW_STOCK_THRESHOLD = 5;

export type DashboardUnavailableSection =
  | 'products'
  | 'listings'
  | 'inventory'
  | 'orders'
  | 'finance'
  | 'integrations'
  | 'storefront'
  | 'operational-state'
  | 'theme';

export interface DashboardModelInput {
  store?: Store;
  products: Product[];
  listings: SellerListing[];
  inventory: InventorySnapshot[];
  orders: SellerOrder[];
  orderTotal: number;
  balance?: StoreBalance | null;
  connections: IntegrationConnection[];
  storefrontHost?: string;
  operationalState?: StoreOperationalState | null;
  themeInstallation?: ThemeInstallation | null;
  themeRevision?: Pick<ThemeInstallationResponse, 'draft_revision' | 'published_revision'> | null;
  unavailable: DashboardUnavailableSection[];
}

export interface DashboardAttentionItem {
  id: string;
  label: string;
  value: string;
  tone: 'critical' | 'warning' | 'success' | 'neutral';
  href?: string;
}

export function formatMinorMoney(valueMinor?: number, currency = 'SAR') {
  const value = Number.isFinite(valueMinor) ? Number(valueMinor) / 100 : 0;

  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(value);
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function getStoreCurrency(store?: Store) {
  switch (store?.market_code) {
    case 'EG':
      return 'EGP';
    case 'AE':
      return 'AED';
    case 'KW':
      return 'KWD';
    case 'SA':
    default:
      return 'SAR';
  }
}

export function getLowStockItems(inventory: InventorySnapshot[]) {
  return inventory
    .filter((item) => item.available_qty <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.available_qty - b.available_qty)
    .slice(0, 5);
}

export function getPendingOrders(orders: SellerOrder[]) {
  return orders.filter((order) => ['pending', 'confirmed', 'processing'].includes(order.status.toLowerCase()));
}

export function getThemeNeedsPublish(themeRevision?: DashboardModelInput['themeRevision']) {
  if (!themeRevision) return false;

  return themeRevision.draft_revision > themeRevision.published_revision;
}

export function buildDashboardModel(input: DashboardModelInput) {
  const publishedListings = input.listings.filter((listing) => listing.status === 'published').length;
  const draftListings = input.listings.filter((listing) => listing.status === 'draft').length;
  const unpublishedListings = input.listings.filter((listing) => listing.status === 'unpublished').length;
  const activeProducts = input.products.filter((product) => product.status === 'active').length;
  const lowStockItems = getLowStockItems(input.inventory);
  const pendingOrders = getPendingOrders(input.orders);
  const channelIssues = input.connections.filter((connection) => ['error', 'disconnected'].includes(connection.status));
  const activeChannels = input.connections.filter((connection) => connection.status === 'active');
  const unavailable = new Set(input.unavailable);
  const currency = input.balance?.currency || getStoreCurrency(input.store);
  const checkoutAccepting = input.operationalState?.checkout_accepting ?? input.operationalState?.checkout_status === 'accepting';
  const themeNeedsPublish = getThemeNeedsPublish(input.themeRevision);

  const launchTasks = [
    input.products.length > 0,
    publishedListings > 0,
    Boolean(input.themeInstallation),
    Boolean(input.storefrontHost),
    input.store?.status === 'active',
    checkoutAccepting
  ];
  const completedLaunchTasks = launchTasks.filter(Boolean).length;
  const readinessPercent = Math.round((completedLaunchTasks / launchTasks.length) * 100);

  const attentionItems: DashboardAttentionItem[] = [
    {
      id: 'orders',
      label: 'Orders waiting',
      value: unavailable.has('orders') ? 'Unavailable' : String(pendingOrders.length),
      tone: pendingOrders.length > 0 ? 'warning' : 'success',
      href: 'orders'
    },
    {
      id: 'stock',
      label: 'Low stock SKUs',
      value: unavailable.has('inventory') ? 'Unavailable' : String(lowStockItems.length),
      tone: lowStockItems.length > 0 ? 'critical' : 'success',
      href: 'inventory'
    },
    {
      id: 'channels',
      label: 'Channel issues',
      value: unavailable.has('integrations') ? 'Unavailable' : String(channelIssues.length),
      tone: channelIssues.length > 0 ? 'critical' : 'success',
      href: 'integrations'
    },
    {
      id: 'readiness',
      label: 'Launch readiness',
      value: `${readinessPercent}%`,
      tone: readinessPercent >= 80 ? 'success' : readinessPercent >= 50 ? 'warning' : 'neutral',
      href: 'storefront'
    }
  ];

  return {
    activeChannels,
    activeProducts,
    attentionItems,
    channelIssues,
    checkoutAccepting,
    completedLaunchTasks,
    currency,
    draftListings,
    lowStockItems,
    pendingOrders,
    publishedListings,
    readinessPercent,
    themeNeedsPublish,
    totalLaunchTasks: launchTasks.length,
    totalOrders: input.orderTotal,
    unavailable,
    unpublishedListings
  };
}
