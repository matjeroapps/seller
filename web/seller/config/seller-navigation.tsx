import type { NavItem } from '@matjerhub/ui-sdk';
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Boxes,
  ChartNoAxesColumn,
  ClipboardPlus,
  CreditCard,
  Layers,
  LayoutDashboard,
  PackageSearch,
  PlugZap,
  ReceiptText,
  ScanSearch,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Store,
  Tags,
  UsersRound,
  UserCog,
  Image as ImageIcon,
  Truck
} from 'lucide-react';

export type SellerNavigationItem = Omit<NavItem, 'children'> & {
  roles?: string[];
  permissions?: string[];
  tenantScoped?: boolean;
  children?: SellerNavigationItem[];
  // Merchant Console requirements (Feature 025): an item renders only when the
  // selected workspace's named capability is active AND the member holds the
  // named Core permission. Items without requirements always render for an
  // operable workspace.
  capability?: 'retail' | 'supply';
};

const iconClassName = 'h-4 w-4';

export function getNavigationForStore(storeId?: string, _roles: string[] = []): SellerNavigationItem[] {
  const storePrefix = storeId ? `/dashboard/stores/${storeId}` : '/dashboard';

  return [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard aria-hidden="true" className={iconClassName} />,
      path: storePrefix
    },
    {
      id: 'catalog',
      label: 'Catalog',
      icon: <Tags aria-hidden="true" className={iconClassName} />,
      path: `${storePrefix}/catalog/products`,
      tenantScoped: true,
      children: [
        {
          id: 'products',
          label: 'Products',
          icon: <PackageSearch aria-hidden="true" className={iconClassName} />,
          path: `${storePrefix}/catalog/products`
        },
        {
          id: 'supplier-offers',
          label: 'Supplier Offers',
          icon: <Truck aria-hidden="true" className={iconClassName} />,
          path: `${storePrefix}/catalog/supplier-offers`
        },
        {
          id: 'listings',
          label: 'Listings',
          icon: <Boxes aria-hidden="true" className={iconClassName} />,
          path: `${storePrefix}/catalog/listings`
        },
        {
          id: 'inventory',
          label: 'Inventory',
          icon: <ChartNoAxesColumn aria-hidden="true" className={iconClassName} />,
          path: `${storePrefix}/inventory`
        },
        {
          id: 'media',
          label: 'Media Library',
          icon: <ImageIcon aria-hidden="true" className={iconClassName} />,
          path: `${storePrefix}/media`
        }
      ]
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: <ShoppingBag aria-hidden="true" className={iconClassName} />,
      path: `${storePrefix}/orders`,
      tenantScoped: true,
      children: [
        {
          id: 'orders-list',
          label: 'Orders list',
          icon: <ShoppingBag aria-hidden="true" className={iconClassName} />,
          path: `${storePrefix}/orders`
        },
        {
          id: 'orders-new',
          label: 'Create order',
          icon: <ClipboardPlus aria-hidden="true" className={iconClassName} />,
          path: `${storePrefix}/orders/new`
        },
        {
          id: 'carts',
          label: 'Carts',
          icon: <ShoppingCart aria-hidden="true" className={iconClassName} />,
          path: `${storePrefix}/carts`
        }
      ]
    },
    {
      id: 'shipments',
      label: 'Shipments',
      icon: <Truck aria-hidden="true" className={iconClassName} />,
      path: `${storePrefix}/shipments`,
      tenantScoped: true
    },
    {
      id: 'customers',
      label: 'Customers',
      icon: <UsersRound aria-hidden="true" className={iconClassName} />,
      path: `${storePrefix}/customers`,
      tenantScoped: true
    },
    {
      id: 'storefront',
      label: 'Storefront',
      icon: <Store aria-hidden="true" className={iconClassName} />,
      path: `${storePrefix}/storefront`,
      tenantScoped: true
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: <BarChart3 aria-hidden="true" className={iconClassName} />,
      path: `${storePrefix}/analytics`,
      tenantScoped: true
    },
    {
      id: 'finance',
      label: 'Finance',
      icon: <CreditCard aria-hidden="true" className={iconClassName} />,
      path: `${storePrefix}/finance`,
      tenantScoped: true,
      children: [
        {
          id: 'finance-overview',
          label: 'Wallet',
          icon: <CreditCard aria-hidden="true" className={iconClassName} />,
          path: `${storePrefix}/finance`
        },
        {
          id: 'payout-request',
          label: 'Payout request',
          icon: <ReceiptText aria-hidden="true" className={iconClassName} />,
          path: `${storePrefix}/finance/payouts/new`
        },
        {
          id: 'billing',
          label: 'Plan & billing',
          icon: <ReceiptText aria-hidden="true" className={iconClassName} />,
          path: `${storePrefix}/billing`
        }
      ]
    },
    {
      id: 'integrations',
      label: 'Integrations',
      icon: <PlugZap aria-hidden="true" className={iconClassName} />,
      path: `${storePrefix}/integrations`,
      tenantScoped: true
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings aria-hidden="true" className={iconClassName} />,
      path: `${storePrefix}/settings`,
      tenantScoped: true,
      children: [
        {
          id: 'store-settings',
          label: 'Store settings',
          icon: <Settings aria-hidden="true" className={iconClassName} />,
          path: `${storePrefix}/settings`
        },
        {
          id: 'notifications',
          label: 'Notifications',
          icon: <Bell aria-hidden="true" className={iconClassName} />,
          path: `${storePrefix}/notifications`
        },
        {
          id: 'account',
          label: 'Profile & account',
          icon: <UserCog aria-hidden="true" className={iconClassName} />,
          path: `${storePrefix}/account`
        },
        {
          id: 'team',
          label: 'Team',
          icon: <UserCog aria-hidden="true" className={iconClassName} />,
          path: `${storePrefix}/users`
        }
      ]
    }
  ];
}

export const sellerNavigation: SellerNavigationItem[] = getNavigationForStore();

export function getNavigationForUserRoles(_roles: string[] = []) {
  return sellerNavigation;
}

// --- Merchant Console navigation (Feature 025) ---

export interface MerchantWorkspaceNavigationContext {
  merchantId: string;
  storeId?: string;
  // Capability states of the selected workspace (from the Core bootstrap).
  capabilities: {
    retail: 'inactive' | 'activating' | 'active' | 'suspended' | undefined;
    supply: 'inactive' | 'activating' | 'active' | 'suspended' | undefined;
  };
  // Effective permissions of the member (from the Core bootstrap).
  permissions: string[];
}

const retailPermission = 'retail.orders.manage';
const supplyPermission = 'supply.catalog.manage';
const supplyFulfillmentPermission = 'supply.fulfillment.manage';

function itemVisible(context: MerchantWorkspaceNavigationContext, item: SellerNavigationItem): boolean {
  if (!item.capability) return true;
  if (context.capabilities[item.capability] !== 'active') return false;
  const required = item.id === 'supply-fulfillment' ? supplyFulfillmentPermission : item.capability === 'retail' ? retailPermission : supplyPermission;
  return context.permissions.includes(required) || context.permissions.includes('merchant.manage');
}

/**
 * Merchant Console navigation for the canonical route hierarchy:
 * `/dashboard/merchants/{merchant_id}` roots, retail store routes nest under
 * the selected store, supply routes live under the supply module.
 *
 * Visibility is capability × permission aware and UX only: every underlying
 * data request remains protected by server authorization.
 */
export function getNavigationForMerchantWorkspace(context: MerchantWorkspaceNavigationContext): SellerNavigationItem[] {
  const { merchantId, storeId } = context;
  const workspacePrefix = `/dashboard/merchants/${merchantId}`;
  const storePrefix = storeId ? `${workspacePrefix}/stores/${storeId}` : null;

  const items: SellerNavigationItem[] = [
    {
      id: 'workspace-dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard aria-hidden="true" className={iconClassName} />,
      path: workspacePrefix
    }
  ];

  if (storePrefix) {
    items.push(
      {
        id: 'catalog',
        label: 'Catalog',
        icon: <Tags aria-hidden="true" className={iconClassName} />,
        path: `${storePrefix}/catalog/products`,
        tenantScoped: true,
        capability: 'retail',
        children: [
          {
            id: 'products',
            label: 'Products',
            icon: <PackageSearch aria-hidden="true" className={iconClassName} />,
            path: `${storePrefix}/catalog/products`,
            capability: 'retail'
          },
          {
            id: 'supplier-offers',
            label: 'Supplier Offers',
            icon: <Truck aria-hidden="true" className={iconClassName} />,
            path: `${storePrefix}/catalog/supplier-offers`,
            capability: 'retail'
          },
          {
            id: 'listings',
            label: 'Listings',
            icon: <Boxes aria-hidden="true" className={iconClassName} />,
            path: `${storePrefix}/catalog/listings`,
            capability: 'retail'
          },
          {
            id: 'inventory',
            label: 'Inventory',
            icon: <ChartNoAxesColumn aria-hidden="true" className={iconClassName} />,
            path: `${storePrefix}/inventory`,
            capability: 'retail'
          },
          {
            id: 'media',
            label: 'Media Library',
            icon: <ImageIcon aria-hidden="true" className={iconClassName} />,
            path: `${storePrefix}/media`,
            capability: 'retail'
          }
        ]
      },
      {
        id: 'orders',
        label: 'Orders',
        icon: <ShoppingBag aria-hidden="true" className={iconClassName} />,
        path: `${storePrefix}/orders`,
        tenantScoped: true,
        capability: 'retail',
        children: [
          {
            id: 'orders-list',
            label: 'Orders list',
            icon: <ShoppingBag aria-hidden="true" className={iconClassName} />,
            path: `${storePrefix}/orders`,
            capability: 'retail'
          },
          {
            id: 'orders-new',
            label: 'Create order',
            icon: <ClipboardPlus aria-hidden="true" className={iconClassName} />,
            path: `${storePrefix}/orders/new`,
            capability: 'retail'
          },
          {
            id: 'carts',
            label: 'Carts',
            icon: <ShoppingCart aria-hidden="true" className={iconClassName} />,
            path: `${storePrefix}/carts`,
            capability: 'retail'
          }
        ]
      },
      {
        id: 'shipments',
        label: 'Shipments',
        icon: <Truck aria-hidden="true" className={iconClassName} />,
        path: `${storePrefix}/shipments`,
        tenantScoped: true,
        capability: 'retail'
      },
      {
        id: 'customers',
        label: 'Customers',
        icon: <UsersRound aria-hidden="true" className={iconClassName} />,
        path: `${storePrefix}/customers`,
        tenantScoped: true,
        capability: 'retail'
      },
      {
        id: 'storefront',
        label: 'Storefront',
        icon: <Store aria-hidden="true" className={iconClassName} />,
        path: `${storePrefix}/storefront`,
        tenantScoped: true,
        capability: 'retail'
      },
      {
        id: 'analytics',
        label: 'Analytics',
        icon: <BarChart3 aria-hidden="true" className={iconClassName} />,
        path: `${storePrefix}/analytics`,
        tenantScoped: true,
        capability: 'retail'
      },
      {
        id: 'finance',
        label: 'Finance',
        icon: <CreditCard aria-hidden="true" className={iconClassName} />,
        path: `${storePrefix}/finance`,
        tenantScoped: true,
        capability: 'retail',
        children: [
          {
            id: 'finance-overview',
            label: 'Wallet',
            icon: <CreditCard aria-hidden="true" className={iconClassName} />,
            path: `${storePrefix}/finance`,
            capability: 'retail'
          },
          {
            id: 'payout-request',
            label: 'Payout request',
            icon: <ReceiptText aria-hidden="true" className={iconClassName} />,
            path: `${storePrefix}/finance/payouts/new`,
            capability: 'retail'
          },
          {
            id: 'billing',
            label: 'Plan & billing',
            icon: <ReceiptText aria-hidden="true" className={iconClassName} />,
            path: `${storePrefix}/billing`,
            capability: 'retail'
          }
        ]
      },
      {
        id: 'integrations',
        label: 'Integrations',
        icon: <PlugZap aria-hidden="true" className={iconClassName} />,
        path: `${storePrefix}/integrations`,
        tenantScoped: true,
        capability: 'retail'
      }
    );
  }

  const supplyChildren: SellerNavigationItem[] = [
    {
      id: 'supply-connections',
      label: 'Connections',
      icon: <PlugZap aria-hidden="true" className={iconClassName} />,
      path: `${workspacePrefix}/supply/connections`,
      capability: 'supply'
    },
    {
      id: 'supply-import-batches',
      label: 'Import batches',
      icon: <Layers aria-hidden="true" className={iconClassName} />,
      path: `${workspacePrefix}/supply/import-batches`,
      capability: 'supply'
    },
    {
      id: 'supply-review-cases',
      label: 'Review cases',
      icon: <ScanSearch aria-hidden="true" className={iconClassName} />,
      path: `${workspacePrefix}/supply/review-cases`,
      capability: 'supply'
    },
    {
      id: 'supply-mappings',
      label: 'Mappings',
      icon: <ArrowLeftRight aria-hidden="true" className={iconClassName} />,
      path: `${workspacePrefix}/supply/mappings`,
      capability: 'supply'
    },
    {
      id: 'supply-synchronization',
      label: 'Synchronization',
      icon: <ChartNoAxesColumn aria-hidden="true" className={iconClassName} />,
      path: `${workspacePrefix}/supply/synchronization`,
      capability: 'supply'
    },
    {
      id: 'supply-fulfillment',
      label: 'Fulfillment',
      icon: <Truck aria-hidden="true" className={iconClassName} />,
      path: `${workspacePrefix}/supply/fulfillment`,
      capability: 'supply'
    }
  ];

  items.push({
    id: 'supply',
    label: 'Supply',
    icon: <Truck aria-hidden="true" className={iconClassName} />,
    path: `${workspacePrefix}/supply/connections`,
    tenantScoped: true,
    capability: 'supply',
    children: supplyChildren
  });

  items.push({
    id: 'settings',
    label: 'Settings',
    icon: <Settings aria-hidden="true" className={iconClassName} />,
    path: storePrefix ? `${storePrefix}/settings` : workspacePrefix,
    tenantScoped: true,
    children: [
      {
        id: 'store-settings',
        label: 'Store settings',
        icon: <Settings aria-hidden="true" className={iconClassName} />,
        path: storePrefix ? `${storePrefix}/settings` : workspacePrefix
      },
      {
        id: 'notifications',
        label: 'Notifications',
        icon: <Bell aria-hidden="true" className={iconClassName} />,
        path: storePrefix ? `${storePrefix}/notifications` : workspacePrefix
      },
      {
        id: 'account',
        label: 'Profile & account',
        icon: <UserCog aria-hidden="true" className={iconClassName} />,
        path: storePrefix ? `${storePrefix}/account` : workspacePrefix
      },
      {
        id: 'team',
        label: 'Team',
        icon: <UserCog aria-hidden="true" className={iconClassName} />,
        path: storePrefix ? `${storePrefix}/users` : workspacePrefix
      }
    ]
  });

  return items.filter((item) => itemVisible(context, item)).map((item) => {
    if (!item.children) return item;
    const children = item.children.filter((child) => itemVisible(context, child));
    return { ...item, children: children.length > 0 ? children : undefined };
  });
}
