export type ScreenClassification =
  | 'live'
  | 'partial'
  | 'setup-required'
  | 'unavailable'
  | 'asset';

export type SellerRole = 'seller_owner' | 'seller_manager' | 'seller_staff';

export interface DataBinding {
  apiEndpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  coreCapability?: string;
  isStoreScoped: boolean;
}

export interface ActionBinding {
  name: string;
  type: 'navigation' | 'mutation' | 'print' | 'manual-review' | 'setup-required' | 'unavailable';
  description: string;
}

export interface MappedScreenRecord {
  designId: string;
  title: string;
  destination: string;
  isRoute: boolean;
  classification: ScreenClassification;
  allowedRoles: SellerRole[];
  dataBinding: DataBinding;
  actions: ActionBinding[];
  emptyBehavior: string;
  unavailableReason?: string;
  testIdentifier: string;
}

export const CANONICAL_SCREEN_REGISTRY: MappedScreenRecord[] = [
  {
    designId: '6cacb65351564341a4c1401391f6bd2b',
    title: 'Store Overview',
    destination: '/dashboard/stores/{store_id}',
    isRoute: true,
    classification: 'live',
    allowedRoles: ['seller_owner', 'seller_manager', 'seller_staff'],
    dataBinding: {
      apiEndpoint: '/api/seller/v1/stores/{store_id}/dashboard',
      method: 'GET',
      coreCapability: 'Store Dashboard Aggregates',
      isStoreScoped: true,
    },
    actions: [{ name: 'View Overview', type: 'navigation', description: 'View dashboard summary facts' }],
    emptyBehavior: 'Displays empty metric cards and zero totals',
    testIdentifier: 'seller-live-screens.spec.ts',
  },
  {
    designId: '6cefceb506614982a45a3e0cfa9efacc',
    title: 'Store Dashboard Metrics',
    destination: '/dashboard/stores/{store_id}',
    isRoute: true,
    classification: 'live',
    allowedRoles: ['seller_owner', 'seller_manager', 'seller_staff'],
    dataBinding: {
      apiEndpoint: '/api/seller/v1/stores/{store_id}/dashboard',
      method: 'GET',
      coreCapability: 'Store Dashboard Metrics',
      isStoreScoped: true,
    },
    actions: [{ name: 'Filter Range', type: 'navigation', description: 'Filter overview metric time range' }],
    emptyBehavior: 'Displays empty charts and summary cards',
    testIdentifier: 'seller-live-screens.spec.ts',
  },
  {
    designId: '7c3b66c38b0a439795ff2223d2800830',
    title: 'Products Catalog',
    destination: '/dashboard/stores/{store_id}/catalog/products',
    isRoute: true,
    classification: 'live',
    allowedRoles: ['seller_owner', 'seller_manager', 'seller_staff'],
    dataBinding: {
      apiEndpoint: '/api/seller/v1/stores/{store_id}/catalog/products',
      method: 'GET',
      coreCapability: 'Catalog Products',
      isStoreScoped: true,
    },
    actions: [
      { name: 'Browse Products', type: 'navigation', description: 'Browse and filter store products' },
      { name: 'Archive Product', type: 'mutation', description: 'Archive existing product' },
    ],
    emptyBehavior: 'Displays actionable empty state with Create Product button',
    testIdentifier: 'live-catalog-orders-screens.test.tsx',
  },
  {
    designId: '5e73823eb2b84a1e937b20a2a38b0a22',
    title: 'Create Product',
    destination: '/dashboard/stores/{store_id}/catalog/products/new',
    isRoute: true,
    classification: 'live',
    allowedRoles: ['seller_owner', 'seller_manager'],
    dataBinding: {
      apiEndpoint: '/api/seller/v1/stores/{store_id}/catalog/products',
      method: 'POST',
      coreCapability: 'Product Creation',
      isStoreScoped: true,
    },
    actions: [{ name: 'Create Product', type: 'mutation', description: 'Submit new product details' }],
    emptyBehavior: 'Form starts clean',
    testIdentifier: 'live-catalog-orders-screens.test.tsx',
  },
  {
    designId: 'c71723a2f55648f59ab40f014b53f95c',
    title: 'Supplier Offers',
    destination: '/dashboard/stores/{store_id}/catalog/supplier-offers',
    isRoute: true,
    classification: 'live',
    allowedRoles: ['seller_owner', 'seller_manager', 'seller_staff'],
    dataBinding: {
      apiEndpoint: '/api/seller/v1/stores/{store_id}/catalog/supplier-offers',
      method: 'GET',
      coreCapability: 'Supplier Catalog Offers',
      isStoreScoped: true,
    },
    actions: [{ name: 'Import Offer', type: 'mutation', description: 'Import supplier offer to catalog' }],
    emptyBehavior: 'Displays empty offer list state',
    testIdentifier: 'live-catalog-orders-screens.test.tsx',
  },
  {
    designId: 'defa5b29119d49ed9967973a9140a418',
    title: 'Inventory Adjustments',
    destination: '/dashboard/stores/{store_id}/inventory',
    isRoute: true,
    classification: 'live',
    allowedRoles: ['seller_owner', 'seller_manager', 'seller_staff'],
    dataBinding: {
      apiEndpoint: '/api/seller/v1/stores/{store_id}/inventory/adjustments',
      method: 'POST',
      coreCapability: 'Inventory Adjustments',
      isStoreScoped: true,
    },
    actions: [{ name: 'Adjust Stock', type: 'mutation', description: 'Adjust product variant stock level' }],
    emptyBehavior: 'Displays empty stock levels list',
    testIdentifier: 'live-catalog-orders-screens.test.tsx',
  },
  {
    designId: 'd5da3f954a144aa9afda5b07d88dd3cb',
    title: 'Media Library',
    destination: '/dashboard/stores/{store_id}/media',
    isRoute: true,
    classification: 'live',
    allowedRoles: ['seller_owner', 'seller_manager', 'seller_staff'],
    dataBinding: {
      apiEndpoint: '/api/seller/v1/stores/{store_id}/media',
      method: 'GET',
      coreCapability: 'Store Media Assets',
      isStoreScoped: true,
    },
    actions: [
      { name: 'Upload Media', type: 'mutation', description: 'Upload media image asset' },
      { name: 'Delete Media', type: 'mutation', description: 'Delete media asset' },
    ],
    emptyBehavior: 'Displays empty upload dropzone',
    testIdentifier: 'live-catalog-orders-screens.test.tsx',
  },
  {
    designId: '73d90e6ca6a248ecbec00ad239d9735a',
    title: 'Orders List',
    destination: '/dashboard/stores/{store_id}/orders',
    isRoute: true,
    classification: 'live',
    allowedRoles: ['seller_owner', 'seller_manager', 'seller_staff'],
    dataBinding: {
      apiEndpoint: '/api/seller/v1/stores/{store_id}/orders',
      method: 'GET',
      coreCapability: 'Store Orders',
      isStoreScoped: true,
    },
    actions: [{ name: 'Filter Orders', type: 'navigation', description: 'Filter store orders by status' }],
    emptyBehavior: 'Displays empty orders list state',
    testIdentifier: 'live-catalog-orders-screens.test.tsx',
  },
  {
    designId: '424d89c31b134fc2a4f289e55fb20bda',
    title: 'Order Details',
    destination: '/dashboard/stores/{store_id}/orders/{order_id}',
    isRoute: true,
    classification: 'live',
    allowedRoles: ['seller_owner', 'seller_manager', 'seller_staff'],
    dataBinding: {
      apiEndpoint: '/api/seller/v1/stores/{store_id}/orders/{order_id}',
      method: 'GET',
      coreCapability: 'Order Operations',
      isStoreScoped: true,
    },
    actions: [
      { name: 'Transition Status', type: 'mutation', description: 'Transition order state' },
      { name: 'Fulfill Shipment', type: 'mutation', description: 'Create order shipment' },
    ],
    emptyBehavior: 'N/A (Order detail loaded by ID)',
    testIdentifier: 'live-catalog-orders-screens.test.tsx',
  },
  {
    designId: 'ed5b5420fae24e6db8d75329f1e8c0cc',
    title: 'New Order Creation',
    destination: '/dashboard/stores/{store_id}/orders/new',
    isRoute: true,
    classification: 'unavailable',
    allowedRoles: ['seller_owner', 'seller_manager', 'seller_staff'],
    dataBinding: { isStoreScoped: true },
    actions: [{ name: 'View Orders', type: 'navigation', description: 'Navigate to real store orders list' }],
    emptyBehavior: 'Clean unavailable state',
    unavailableReason: 'Manual seller order creation is not supported by Core.',
    testIdentifier: 'live-catalog-orders-screens.test.tsx',
  },
  {
    designId: 'ff4c1d6815b74cf68e80c9ff8bc1a84e',
    title: 'Order Documents',
    destination: '/dashboard/stores/{store_id}/orders/{order_id}/documents',
    isRoute: true,
    classification: 'partial',
    allowedRoles: ['seller_owner', 'seller_manager', 'seller_staff'],
    dataBinding: {
      apiEndpoint: '/api/seller/v1/stores/{store_id}/orders/{order_id}',
      method: 'GET',
      coreCapability: 'Order Documents Markup',
      isStoreScoped: true,
    },
    actions: [
      { name: 'Print Browser Markup', type: 'print', description: 'Print order packing slip / invoice markup' },
      { name: 'Export ZATCA / PDF', type: 'unavailable', description: 'PDF export & ZATCA signing is unavailable' },
    ],
    emptyBehavior: 'N/A',
    unavailableReason: 'PDF generation and ZATCA tax invoice signing are not supported by Core.',
    testIdentifier: 'live-operations-screens.test.tsx',
  },
  {
    designId: '5ceeb286adbe468988c686b24ab1da8d',
    title: 'Shipments Management',
    destination: '/dashboard/stores/{store_id}/shipments',
    isRoute: true,
    classification: 'partial',
    allowedRoles: ['seller_owner', 'seller_manager', 'seller_staff'],
    dataBinding: {
      apiEndpoint: '/api/seller/v1/stores/{store_id}/orders',
      method: 'GET',
      coreCapability: 'Store Order Selector for Fulfillment',
      isStoreScoped: true,
    },
    actions: [{ name: 'Select Order & Fulfill', type: 'mutation', description: 'Select order and fulfill shipment' }],
    emptyBehavior: 'Displays empty shipment list state',
    unavailableReason: 'Store-wide unlinked shipment list is not supported by Core; shipments are created per order.',
    testIdentifier: 'live-catalog-orders-screens.test.tsx',
  },
  {
    designId: '478f8f92cdfe40cf80886f8fd8757eab',
    title: 'Customer Carts',
    destination: '/dashboard/stores/{store_id}/carts',
    isRoute: true,
    classification: 'unavailable',
    allowedRoles: ['seller_owner', 'seller_manager', 'seller_staff'],
    dataBinding: { isStoreScoped: true },
    actions: [{ name: 'View Orders', type: 'navigation', description: 'Navigate to real store orders list' }],
    emptyBehavior: 'Clean unavailable state',
    unavailableReason: 'Seller active cart tracking and abandoned cart recovery are not supported by Core.',
    testIdentifier: 'live-operations-screens.test.tsx',
  },
  {
    designId: '1f334d8bdad54aefbd7bed5eb96cfc21',
    title: 'Customers List',
    destination: '/dashboard/stores/{store_id}/customers',
    isRoute: true,
    classification: 'unavailable',
    allowedRoles: ['seller_owner', 'seller_manager', 'seller_staff'],
    dataBinding: { isStoreScoped: true },
    actions: [{ name: 'View Orders', type: 'navigation', description: 'Navigate to real store orders list' }],
    emptyBehavior: 'Clean unavailable state',
    unavailableReason: 'Customer record management and customer directory are not supported by Core.',
    testIdentifier: 'live-operations-screens.test.tsx',
  },
  {
    designId: '1b8dda660f134587a47a06314ce74595',
    title: 'Create Customer',
    destination: '/dashboard/stores/{store_id}/customers/new',
    isRoute: true,
    classification: 'unavailable',
    allowedRoles: ['seller_owner', 'seller_manager'],
    dataBinding: { isStoreScoped: true },
    actions: [{ name: 'View Orders', type: 'navigation', description: 'Navigate to real store orders list' }],
    emptyBehavior: 'Clean unavailable state',
    unavailableReason: 'Customer creation is not supported by Core.',
    testIdentifier: 'live-operations-screens.test.tsx',
  },
  {
    designId: '237be697ef1443e9b91185890783a370',
    title: 'Finance Wallet & Settlements',
    destination: '/dashboard/stores/{store_id}/finance',
    isRoute: true,
    classification: 'live',
    allowedRoles: ['seller_owner', 'seller_manager'],
    dataBinding: {
      apiEndpoint: '/api/seller/v1/stores/{store_id}/finance/wallet',
      method: 'GET',
      coreCapability: 'Wallet & Settlement Ledger',
      isStoreScoped: true,
    },
    actions: [{ name: 'View Balance & History', type: 'navigation', description: 'View wallet balance and ledger history' }],
    emptyBehavior: 'Displays zero balance and zero payouts',
    testIdentifier: 'live-operations-screens.test.tsx',
  },
  {
    designId: '17f36244d1844164b44ddcd20b367ef2',
    title: 'New Payout Request',
    destination: '/dashboard/stores/{store_id}/finance/payouts/new',
    isRoute: true,
    classification: 'unavailable',
    allowedRoles: ['seller_owner'],
    dataBinding: { isStoreScoped: true },
    actions: [{ name: 'View Wallet', type: 'navigation', description: 'Navigate to finance overview' }],
    emptyBehavior: 'Clean unavailable state',
    unavailableReason: 'Manual payout requests and bank account verification are not supported by Core.',
    testIdentifier: 'live-operations-screens.test.tsx',
  },
  {
    designId: '33f3feaf951c4457abda24ed0eab0d2c',
    title: 'Integrations & API Keys',
    destination: '/dashboard/stores/{store_id}/integrations',
    isRoute: true,
    classification: 'live',
    allowedRoles: ['seller_owner', 'seller_manager'],
    dataBinding: {
      apiEndpoint: '/api/seller/v1/stores/{store_id}/integrations',
      method: 'GET',
      coreCapability: 'Integration Connectors & API Keys',
      isStoreScoped: true,
    },
    actions: [
      { name: 'Connect Integration', type: 'mutation', description: 'Connect integration provider' },
      { name: 'Create API Key', type: 'mutation', description: 'Generate new API key' },
      { name: 'Revoke API Key', type: 'mutation', description: 'Revoke existing API key' },
    ],
    emptyBehavior: 'Displays empty active integrations list',
    testIdentifier: 'live-operations-screens.test.tsx',
  },
  {
    designId: '2f0f555364c2499ca0eb20106644027e',
    title: 'Store Settings',
    destination: '/dashboard/stores/{store_id}/settings',
    isRoute: true,
    classification: 'partial',
    allowedRoles: ['seller_owner', 'seller_manager'],
    dataBinding: {
      apiEndpoint: '/api/seller/v1/stores/{store_id}/settings',
      method: 'GET',
      coreCapability: 'Store Operational Details',
      isStoreScoped: true,
    },
    actions: [
      { name: 'View Operational Details', type: 'navigation', description: 'View store details and domain' },
      { name: 'Edit General Policies / Tax', type: 'unavailable', description: 'Editing custom tax rules & policies is unavailable' },
    ],
    emptyBehavior: 'N/A',
    unavailableReason: 'Editing general store policies, tax rules, and localized formats is not supported by Core.',
    testIdentifier: 'live-operations-screens.test.tsx',
  },
  {
    designId: '26eb0d93e46c4dbebc6a0ad23f33a6f1',
    title: 'Account Profile',
    destination: '/dashboard/stores/{store_id}/account',
    isRoute: true,
    classification: 'partial',
    allowedRoles: ['seller_owner', 'seller_manager', 'seller_staff'],
    dataBinding: {
      apiEndpoint: '/api/seller/v1/profile',
      method: 'GET',
      coreCapability: 'Seller Profile',
      isStoreScoped: false,
    },
    actions: [
      { name: 'Update Profile', type: 'mutation', description: 'Save seller name & phone' },
      { name: 'Manage 2FA / Passkeys', type: 'unavailable', description: 'Managing 2FA, active sessions, and passkeys is unavailable' },
    ],
    emptyBehavior: 'N/A',
    unavailableReason: '2FA, passkey management, and session revocation are managed externally by Identity provider (ZITADEL).',
    testIdentifier: 'live-operations-screens.test.tsx',
  },
  {
    designId: '38895d30b510491fbb8e60981b8e97a6',
    title: 'Notifications Center',
    destination: '/dashboard/stores/{store_id}/notifications',
    isRoute: true,
    classification: 'unavailable',
    allowedRoles: ['seller_owner', 'seller_manager', 'seller_staff'],
    dataBinding: { isStoreScoped: true },
    actions: [{ name: 'View Account', type: 'navigation', description: 'Navigate to account profile' }],
    emptyBehavior: 'Clean unavailable state',
    unavailableReason: 'In-app seller notification feed and channel preferences are not supported by Core.',
    testIdentifier: 'live-operations-screens.test.tsx',
  },
  {
    designId: 'bf9ce524deb64412a64ef9688429837e',
    title: 'Team Management',
    destination: '/dashboard/stores/{store_id}/users',
    isRoute: true,
    classification: 'unavailable',
    allowedRoles: ['seller_owner'],
    dataBinding: { isStoreScoped: true },
    actions: [{ name: 'View Settings', type: 'navigation', description: 'Navigate to store settings' }],
    emptyBehavior: 'Clean unavailable state',
    unavailableReason: 'Multi-user team invitations and role management are not supported by Core.',
    testIdentifier: 'live-operations-screens.test.tsx',
  },
  {
    designId: 'cbb6e6cdd7344c62b023c3644a98bfb6',
    title: 'Billing & Plans A',
    destination: '/dashboard/stores/{store_id}/billing',
    isRoute: true,
    classification: 'unavailable',
    allowedRoles: ['seller_owner'],
    dataBinding: { isStoreScoped: true },
    actions: [{ name: 'View Finance', type: 'navigation', description: 'Navigate to finance overview' }],
    emptyBehavior: 'Clean unavailable state',
    unavailableReason: 'Platform subscription plans, invoices, and billing are not supported by Core.',
    testIdentifier: 'live-operations-screens.test.tsx',
  },
  {
    designId: 'ecee261b51834999ae3a6513047e95d6',
    title: 'Billing & Plans B',
    destination: '/dashboard/stores/{store_id}/billing',
    isRoute: true,
    classification: 'unavailable',
    allowedRoles: ['seller_owner'],
    dataBinding: { isStoreScoped: true },
    actions: [{ name: 'View Finance', type: 'navigation', description: 'Navigate to finance overview' }],
    emptyBehavior: 'Clean unavailable state',
    unavailableReason: 'Duplicate design record mapped to unavailable billing capability.',
    testIdentifier: 'live-operations-screens.test.tsx',
  },
  {
    designId: 'f211c59b08a6439d8181ed25c5abc541',
    title: 'Advanced Analytics',
    destination: '/dashboard/stores/{store_id}/analytics',
    isRoute: true,
    classification: 'unavailable',
    allowedRoles: ['seller_owner', 'seller_manager'],
    dataBinding: { isStoreScoped: true },
    actions: [{ name: 'View Overview', type: 'navigation', description: 'Navigate to dashboard overview' }],
    emptyBehavior: 'Clean unavailable state',
    unavailableReason: 'Advanced reporting, scheduled exports, and cohort analytics are not supported by Core.',
    testIdentifier: 'live-operations-screens.test.tsx',
  },
  {
    designId: 'f44bf2a9fe894e8588b728e68020ed84',
    title: 'Storefront & Themes',
    destination: '/dashboard/stores/{store_id}/storefront',
    isRoute: true,
    classification: 'live',
    allowedRoles: ['seller_owner', 'seller_manager'],
    dataBinding: {
      apiEndpoint: '/api/seller/v1/stores/{store_id}/storefront',
      method: 'GET',
      coreCapability: 'Storefront Themes & Host Settings',
      isStoreScoped: true,
    },
    actions: [
      { name: 'Install Theme', type: 'mutation', description: 'Install custom theme' },
      { name: 'Publish Theme', type: 'mutation', description: 'Publish installed theme' },
    ],
    emptyBehavior: 'Displays active system default theme with no custom installed themes',
    testIdentifier: 'live-operations-screens.test.tsx',
  },
  {
    designId: 'cc2a635b61244038b532a6ced210873f',
    title: 'Brand Logo Asset',
    destination: 'Non-route asset',
    isRoute: false,
    classification: 'asset',
    allowedRoles: [],
    dataBinding: { isStoreScoped: false },
    actions: [],
    emptyBehavior: 'N/A',
    testIdentifier: 'screen-registry.test.ts',
  },
  {
    designId: 'cc8331289828447385c2725e039aaa4c',
    title: 'Avatar Image Asset',
    destination: 'Non-route asset',
    isRoute: false,
    classification: 'asset',
    allowedRoles: [],
    dataBinding: { isStoreScoped: false },
    actions: [],
    emptyBehavior: 'N/A',
    testIdentifier: 'screen-registry.test.ts',
  },
];

export function getScreenByDesignId(designId: string): MappedScreenRecord | undefined {
  return CANONICAL_SCREEN_REGISTRY.find((r) => r.designId === designId);
}

export function getScreenByRoute(routePattern: string): MappedScreenRecord[] {
  return CANONICAL_SCREEN_REGISTRY.filter((r) => r.isRoute && r.destination === routePattern);
}

export function getAllMappedScreens(): MappedScreenRecord[] {
  return CANONICAL_SCREEN_REGISTRY;
}

export function getRouteScreens(): MappedScreenRecord[] {
  return CANONICAL_SCREEN_REGISTRY.filter((r) => r.isRoute);
}
