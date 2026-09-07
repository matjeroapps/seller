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
  UsersRound
} from 'lucide-react';

export type SellerNavigationItem = NavItem & {
  roles?: string[];
  permissions?: string[];
  tenantScoped?: boolean;
};

const iconClassName = 'h-4 w-4';

export const sellerNavigation: SellerNavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard aria-hidden="true" className={iconClassName} />,
    path: '/dashboard'
  },
  {
    id: 'catalog',
    label: 'Catalog',
    icon: <Tags aria-hidden="true" className={iconClassName} />,
    path: '/dashboard/catalog',
    tenantScoped: true,
    children: [
      {
        id: 'products',
        label: 'Products',
        icon: <PackageSearch aria-hidden="true" className={iconClassName} />,
        path: '/dashboard/catalog/products'
      },
      {
        id: 'variants',
        label: 'Variants',
        icon: <Boxes aria-hidden="true" className={iconClassName} />,
        path: '/dashboard/catalog/variants'
      },
      {
        id: 'inventory',
        label: 'Inventory',
        icon: <ChartNoAxesColumn aria-hidden="true" className={iconClassName} />,
        path: '/dashboard/catalog/inventory'
      }
    ]
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: <ShoppingBag aria-hidden="true" className={iconClassName} />,
    path: '/dashboard/orders',
    tenantScoped: true
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: <UsersRound aria-hidden="true" className={iconClassName} />,
    path: '/dashboard/customers',
    tenantScoped: true
  },
  {
    id: 'storefront',
    label: 'Storefront',
    icon: <Store aria-hidden="true" className={iconClassName} />,
    path: '/dashboard/storefront',
    tenantScoped: true
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <BarChart3 aria-hidden="true" className={iconClassName} />,
    path: '/dashboard/analytics',
    tenantScoped: true
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings aria-hidden="true" className={iconClassName} />,
    path: '/dashboard/settings',
    tenantScoped: true
  }
];

export function getNavigationForUserRoles(_roles: string[] = []) {
  return sellerNavigation;
}
