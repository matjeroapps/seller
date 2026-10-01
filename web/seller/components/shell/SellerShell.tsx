'use client';

import {
  Bell,
  ChevronDown,
  CircleHelp,
  Globe2,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Store,
  Sun,
  UserRound,
  X
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { getNavigationForStore, type SellerNavigationItem } from '@/config/seller-navigation';
import type { SellerUser } from '@/lib/auth';
import { StoreSwitcher } from './StoreSwitcher';

function isItemActive(pathname: string, item: SellerNavigationItem) {
  if (pathname === item.path || pathname.startsWith(`${item.path}/`)) return true;

  return Boolean(item.children?.some((child) => pathname === child.path || pathname.startsWith(`${child.path}/`)));
}

function getFlatNavigation(items: SellerNavigationItem[]) {
  return items.flatMap((item) => [item, ...(item.children || [])]);
}

export function SellerShell({ children, user }: { children: ReactNode; user: SellerUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr');
  const [profileOpen, setProfileOpen] = useState(false);

  const currentStoreId = pathname.match(/\/dashboard\/stores\/([^/]+)/)?.[1];
  const navItems = useMemo(() => getNavigationForStore(currentStoreId, user.roles), [currentStoreId, user.roles]);
  const activeItem = getFlatNavigation(navItems)
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));

  const breadcrumbs = [
    { label: 'Dashboard', path: currentStoreId ? `/dashboard/stores/${currentStoreId}` : '/dashboard' },
    ...(activeItem && activeItem.id !== 'dashboard' ? [{ label: activeItem.label, path: activeItem.path }] : [])
  ];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = direction === 'rtl' ? 'ar' : 'en';
  }, [direction]);

  const navigate = (path: string) => {
    setMobileNavOpen(false);
    setProfileOpen(false);
    router.push(path);
  };

  const settingsPath = currentStoreId ? `/dashboard/stores/${currentStoreId}/settings` : '/dashboard/settings';
  const catalogSearchPath = currentStoreId ? `/dashboard/stores/${currentStoreId}/catalog/products` : '/dashboard';

  return (
    <div className="seller-app-shell" data-theme={theme}>
      <aside className={`seller-sidebar ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Seller navigation">
        <div className="seller-sidebar__brand">
          <button type="button" className="seller-brand" onClick={() => navigate(currentStoreId ? `/dashboard/stores/${currentStoreId}` : '/dashboard')}>
            <span className="seller-brand__mark">M</span>
            <span>
              <span className="seller-brand__name">MatjerHub</span>
              <span className="seller-brand__meta">Seller Portal</span>
            </span>
          </button>
          <button type="button" className="seller-icon-button seller-sidebar__close" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation">
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="seller-sidebar__store">
          <StoreSwitcher currentStoreId={currentStoreId} />
        </div>

        <nav className="seller-sidebar__nav">
          {navItems.map((item) => {
            const isActive = isItemActive(pathname, item);
            const isExpanded = isActive || item.id === 'catalog';

            return (
              <div className="seller-nav-group" key={item.id}>
                <button
                  type="button"
                  className={`seller-nav-item ${isActive ? 'is-active' : ''}`}
                  onClick={() => navigate(item.path)}
                  aria-current={pathname === item.path ? 'page' : undefined}
                >
                  <span className="seller-nav-item__icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
                {item.children && isExpanded && (
                  <div className="seller-nav-children">
                    {item.children.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        className={`seller-nav-child ${isItemActive(pathname, child) ? 'is-active' : ''}`}
                        onClick={() => navigate(child.path)}
                        aria-current={pathname === child.path ? 'page' : undefined}
                      >
                        <span className="seller-nav-item__icon">{child.icon}</span>
                        <span>{child.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {mobileNavOpen && <button type="button" aria-label="Close navigation overlay" className="seller-sidebar-overlay" onClick={() => setMobileNavOpen(false)} />}

      <div className="seller-workspace">
        <header className="seller-topbar">
          <div className="seller-topbar__left">
            <button type="button" className="seller-icon-button seller-topbar__menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
              <Menu aria-hidden="true" />
            </button>
            <nav className="seller-breadcrumbs" aria-label="Breadcrumb">
              {breadcrumbs.map((crumb, index) => (
                <span key={crumb.path} className="seller-breadcrumbs__item">
                  {index > 0 && <span className="seller-breadcrumbs__divider">/</span>}
                  <button type="button" onClick={() => navigate(crumb.path)} aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}>
                    {crumb.label}
                  </button>
                </span>
              ))}
            </nav>
          </div>

          <button type="button" className="seller-search-command" onClick={() => navigate(catalogSearchPath)}>
            <Search aria-hidden="true" />
            <span>Search catalog</span>
          </button>

          <div className="seller-topbar__actions">
            <button
              type="button"
              className="seller-icon-button"
              onClick={() => setDirection((value) => (value === 'ltr' ? 'rtl' : 'ltr'))}
              aria-label={direction === 'ltr' ? 'Switch to Arabic layout' : 'Switch to English layout'}
            >
              <Globe2 aria-hidden="true" />
            </button>
            <button type="button" className="seller-icon-button" onClick={() => setTheme((value) => (value === 'light' ? 'dark' : 'light'))} aria-label="Toggle color mode">
              {theme === 'light' ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
            </button>
            <button type="button" className="seller-icon-button" onClick={() => navigate(settingsPath)} aria-label="Help and settings">
              <CircleHelp aria-hidden="true" />
            </button>
            <button type="button" className="seller-icon-button seller-notification-button" aria-label="Notifications">
              <Bell aria-hidden="true" />
              <span aria-hidden="true" />
            </button>
            <div className="seller-profile">
              <button type="button" className="seller-profile__trigger" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}>
                <span className="seller-profile__avatar">{user.name.slice(0, 2).toUpperCase()}</span>
                <span className="seller-profile__text">
                  <span>{user.name}</span>
                  <span>{user.roles[0] || 'Seller'}</span>
                </span>
                <ChevronDown aria-hidden="true" />
              </button>
              {profileOpen && (
                <div className="seller-profile__menu">
                  <button type="button" onClick={() => navigate(settingsPath)}>
                    <Settings aria-hidden="true" />
                    Account settings
                  </button>
                  <button type="button" onClick={() => navigate('/dashboard')}>
                    <Store aria-hidden="true" />
                    Switch workspace
                  </button>
                  <button type="button" onClick={() => navigate('/logout')}>
                    <LogOut aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main id="main-content" className="seller-main">
          {children}
        </main>
      </div>
    </div>
  );
}
