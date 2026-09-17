'use client';

import { DashboardLayout, type UserMenuProps } from '@matjerhub/ui-sdk';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { getNavigationForStore } from '@/config/seller-navigation';
import type { SellerUser } from '@/lib/auth';
import { StoreSwitcher } from './StoreSwitcher';

export function SellerShell({ children, user }: { children: ReactNode; user: SellerUser }) {
  const pathname = usePathname();
  const router = useRouter();

  // Extract storeId from pathname e.g. /dashboard/stores/{store_id}/...
  const storeIdMatch = pathname.match(/\/dashboard\/stores\/([^/]+)/);
  const currentStoreId = storeIdMatch ? storeIdMatch[1] : undefined;

  const navItems = getNavigationForStore(currentStoreId, user.roles);

  const menuUser: UserMenuProps['user'] = {
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.roles[0] || 'Seller'
  };

  const activeItem = navItems
    .flatMap((item) => [item, ...(item.children || [])])
    .find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));

  return (
    <div className="seller-shell-frame">
      <DashboardLayout
        appTitle="MatjerHub Seller"
        navItems={navItems}
        currentPath={pathname}
        onNavigate={(path) => router.push(path)}
        breadcrumbsItems={[
          { label: 'Dashboard', href: currentStoreId ? `/dashboard/stores/${currentStoreId}` : '/dashboard' },
          ...(activeItem && activeItem.path !== '/dashboard' ? [{ label: activeItem.label, href: activeItem.path }] : [])
        ]}
        workspaces={[{ id: 'seller', name: 'Seller Workspace', type: 'seller' }]}
        activeWorkspaceId="seller"
        user={menuUser}
        onSignOut={() => router.push('/logout')}
        onSettingsClick={() => router.push(currentStoreId ? `/dashboard/stores/${currentStoreId}/settings` : '/dashboard/settings')}
      >
        <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
          <StoreSwitcher currentStoreId={currentStoreId} />
        </div>
        <div id="main-content">{children}</div>
      </DashboardLayout>
    </div>
  );
}
