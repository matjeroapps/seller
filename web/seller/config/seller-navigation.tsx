import type { NavItem } from '@matjerhub/ui-sdk';
import {
  BarChart3,
  Boxes,
  ChartNoAxesColumn,
  LayoutDashboard,
  PackageSearch,
  Settings,
  ShoppingBag,
  Store,
  Tags,
  UsersRound,
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
      id: 'settings',
      label: 'Settings',
      icon: <Settings aria-hidden="true" className={iconClassName} />,
      path: `${storePrefix}/settings`,
      tenantScoped: true
    }
  ];
}

export const sellerNavigation: SellerNavigationItem[] = getNavigationForStore();

export function getNavigationForUserRoles(_roles: string[] = []) {
  return sellerNavigation;
}
