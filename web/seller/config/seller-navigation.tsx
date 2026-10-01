import type { NavItem } from '@matjerhub/ui-sdk';
import {
  BarChart3,
  Bell,
  Boxes,
  ChartNoAxesColumn,
  ClipboardPlus,
  CreditCard,
  LayoutDashboard,
  PackageSearch,
  PlugZap,
  ReceiptText,
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

export type SellerNavigationItem = NavItem & {
  roles?: string[];
  permissions?: string[];
  tenantScoped?: boolean;
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
