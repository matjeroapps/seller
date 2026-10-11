'use client';

import {
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

import {
  getNavigationForMerchantWorkspace,
  getNavigationForStore,
  type MerchantWorkspaceNavigationContext,
  type SellerNavigationItem
} from '@/config/seller-navigation';
import type { SellerUser } from '@/lib/auth';
import {
  fetchMerchantConsole,
  isOperableWorkspace,
  type MerchantConsoleBootstrap
} from '@/lib/api/merchant-console';
import { MerchantAccessDenied } from './MerchantAccessDenied';
import { MerchantWorkspaceSwitcher } from './MerchantWorkspaceSwitcher';
import { SellerShellUserProvider } from './SellerShellContext';
import { StoreSwitcher } from './StoreSwitcher';
import { useTranslation } from '@/lib/i18n/locale-context';

// Console state for the merchant-aware shell. `status` reflects the bootstrap
// resolution of the URL-selected workspace; the data always comes from the
// Seller BFF (never Core directly).
type ConsoleState =
  | { status: 'legacy' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'denied' }
  | { status: 'ready'; console: MerchantConsoleBootstrap; merchantId: string };

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
  const { toggleLocale, direction, t } = useTranslation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [consoleState, setConsoleState] = useState<ConsoleState>({ status: 'legacy' });

  // Legacy store paths remain compatibility entrypoints; canonical merchant
  // workspace paths carry the explicit selected merchant in the URL.
  const legacyStoreId = pathname.match(/\/dashboard\/stores\/([^/]+)/)?.[1];
  const merchantMatch = pathname.match(/\/dashboard\/merchants\/([^/]+)(?:\/stores\/([^/]+))?/);
  const merchantId = merchantMatch?.[1];
  const merchantStoreId = merchantMatch?.[2];
  const inMerchantContext = Boolean(merchantId);

  useEffect(() => {
    if (!merchantId) {
      setConsoleState({ status: 'legacy' });
      return;
    }
    // Cancel stale in-flight requests and drop previous workspace data on
    // switch: every merchant-scoped view reloads from the selected workspace.
    // The per-merchant abort keying means a resolution finished for the
    // previously selected workspace is never applied to the newly selected
    // one, and a remount while a resolution is in flight cannot resolve the
    // same merchant's bootstrap twice.
    const controller = new AbortController();
    setConsoleState({ status: 'loading' });
    fetchMerchantConsole(merchantId, controller.signal)
      .then((bootstrap) => {
        if (controller.signal.aborted) return;
        const selected = bootstrap.workspaces.find((ws) => ws.merchant_id === merchantId);
        if (!selected || !isOperableWorkspace(selected)) {
          setConsoleState({ status: 'denied' });
          return;
        }
        // Only a bootstrap whose selected workspace still matches the current
        // URL is applied — a redirect/dataview that raced with this one cannot
        // restage a stale workspace or an out-of-date store selection.
        const currentUrlMerchant = pathname.match(/\/dashboard\/merchants\/([^/]+)/)?.[1];
        if (currentUrlMerchant !== merchantId) return;
        setConsoleState({ status: 'ready', console: bootstrap, merchantId });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setConsoleState(error instanceof Error && error.name === 'AbortError' ? { status: 'loading' } : { status: 'error' });
      });
    return () => controller.abort();
  }, [merchantId]);

  const selectedWorkspace =
    consoleState.status === 'ready' ? consoleState.console.workspaces.find((ws) => ws.merchant_id === consoleState.merchantId) : undefined;

  const navItems = useMemo<SellerNavigationItem[]>(() => {
    if (consoleState.status === 'ready' && selectedWorkspace) {
      const context: MerchantWorkspaceNavigationContext = {
        merchantId: consoleState.merchantId,
        storeId: merchantStoreId,
        capabilities: {
          retail: selectedWorkspace.capabilities?.retail?.status,
          supply: selectedWorkspace.capabilities?.supply?.status
        },
        permissions: selectedWorkspace.membership.permissions
      };
      return getNavigationForMerchantWorkspace(context);
    }
    return getNavigationForStore(legacyStoreId, user.roles);
  }, [consoleState, selectedWorkspace, consoleState.status === 'ready' ? consoleState.merchantId : '', merchantStoreId, legacyStoreId, user.roles]);

  const activeItem = getFlatNavigation(navItems)
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));

  const workspaceRoot = inMerchantContext && merchantId ? `/dashboard/merchants/${merchantId}` : null;
  const breadcrumbs = [
    { label: t('nav.dashboard'), path: workspaceRoot || (legacyStoreId ? `/dashboard/stores/${legacyStoreId}` : '/dashboard') },
    ...(activeItem && activeItem.id !== 'dashboard' && activeItem.id !== 'workspace-dashboard' ? [{ label: t(activeItem.labelKey || '', activeItem.label), path: activeItem.path }] : [])
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

  const submitCatalogSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = catalogQuery.trim();
    const destination = query ? `${catalogSearchPath}?query=${encodeURIComponent(query)}` : catalogSearchPath;
    navigate(destination);
  };

  const currentStoreId = inMerchantContext ? merchantStoreId : legacyStoreId;
  const storeBase = currentStoreId
    ? inMerchantContext && merchantId
      ? `/dashboard/merchants/${merchantId}/stores/${currentStoreId}`
      : `/dashboard/stores/${currentStoreId}`
    : null;
  const settingsPath = storeBase ? `${storeBase}/settings` : inMerchantContext && merchantId ? `/dashboard/merchants/${merchantId}` : '/dashboard/settings';
  const profilePath = storeBase ? `${storeBase}/account` : settingsPath;
  const catalogSearchPath = storeBase ? `${storeBase}/catalog/products` : workspaceRoot || '/dashboard';

  return (
    <SellerShellUserProvider user={user}>
      <div className="seller-app-shell" data-theme={theme}>
      <aside className={`seller-sidebar ${mobileNavOpen ? 'is-open' : ''}`} aria-label={t('shell.sellerNavigation')}>
        <div className="seller-sidebar__brand">
          <button type="button" className="seller-brand" onClick={() => navigate(storeBase || workspaceRoot || '/dashboard')}>
            <span className="seller-brand__mark">M</span>
            <span>
              <span className="seller-brand__name">MatjerHub</span>
              <span className="seller-brand__meta">{t('shell.sellerPortal')}</span>
            </span>
          </button>
          <button type="button" className="seller-icon-button seller-sidebar__close" onClick={() => setMobileNavOpen(false)} aria-label={t('shell.closeNavigation')}>
            <X aria-hidden="true" />
          </button>
        </div>

        {consoleState.status === 'ready' && selectedWorkspace && (
          <MerchantWorkspaceSwitcher
            workspaces={consoleState.console.workspaces}
            selectedMerchantId={consoleState.merchantId}
            onSelect={(nextMerchantId) => {
              // Never reuse a store selection from another workspace.
              navigate(`/dashboard/merchants/${nextMerchantId}`);
            }}
          />
        )}
        <div className="seller-sidebar__store">
          <StoreSwitcher
            currentStoreId={inMerchantContext ? merchantStoreId : legacyStoreId}
            workspaceStores={consoleState.status === 'ready' ? selectedWorkspace?.stores : undefined}
            workspaceMerchantId={consoleState.status === 'ready' ? consoleState.merchantId : undefined}
          />
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
                  <span>{t(item.labelKey || '', item.label)}</span>
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
                        <span>{t(child.labelKey || '', child.label)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {mobileNavOpen && <button type="button" aria-label={t('shell.closeNavigationOverlay')} className="seller-sidebar-overlay" onClick={() => setMobileNavOpen(false)} />}

      <div className="seller-workspace">
        <header className="seller-topbar">
          <div className="seller-topbar__left">
            <button type="button" className="seller-icon-button seller-topbar__menu" onClick={() => setMobileNavOpen(true)} aria-label={t('shell.openNavigation')}>
              <Menu aria-hidden="true" />
            </button>
            <nav className="seller-breadcrumbs" aria-label={t('shell.breadcrumb')}>
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

          <form className="seller-search-command" role="search" onSubmit={submitCatalogSearch}>
            <Search aria-hidden="true" />
            <label className="sr-only" htmlFor="seller-catalog-search">
              {t('shell.searchCatalog')}
            </label>
            <input
              id="seller-catalog-search"
              type="search"
              name="query"
              value={catalogQuery}
              onChange={(event) => setCatalogQuery(event.target.value)}
              placeholder={t('shell.searchCatalog')}
              aria-label={t('shell.searchCatalog')}
              autoComplete="off"
            />
            <button type="submit" className="sr-only" aria-label={t('shell.submitCatalogSearch')}>
              {t('common.search')}
            </button>
          </form>

          <div className="seller-topbar__actions">
            <button
              type="button"
              className="seller-icon-button"
              onClick={toggleLocale}
              aria-label={direction === 'ltr' ? t('shell.switchToArabicLayout') : t('shell.switchToEnglishLayout')}
            >
              <Globe2 aria-hidden="true" />
            </button>
            <button type="button" className="seller-icon-button" onClick={() => setTheme((value) => (value === 'light' ? 'dark' : 'light'))} aria-label={t('shell.toggleColorMode')}>
              {theme === 'light' ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
            </button>
            <button type="button" className="seller-icon-button" onClick={() => navigate(settingsPath)} aria-label={t('shell.helpAndSettings')}>
              <CircleHelp aria-hidden="true" />
            </button>
            <div className="seller-profile">
              <button type="button" className="seller-profile__trigger" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}>
                <span className="seller-profile__avatar">{user.name.slice(0, 2).toUpperCase()}</span>
                <span className="seller-profile__text">
                  <span>{user.name}</span>
                  <span>
                    {consoleState.status === 'ready' && selectedWorkspace
                      ? `${selectedWorkspace.legal_name} · ${selectedWorkspace.membership.status}`
                      : user.roles[0] || t('shell.sellerRole')}
                  </span>
                </span>
                <ChevronDown aria-hidden="true" />
              </button>
              {profileOpen && (
                <div className="seller-profile__menu">
                  <button type="button" onClick={() => navigate(profilePath)}>
                    <Settings aria-hidden="true" />
                    {t('shell.accountSettings')}
                  </button>
                  <button type="button" onClick={() => navigate('/dashboard')}>
                    <Store aria-hidden="true" />
                    {t('shell.switchWorkspace')}
                  </button>
                  <button type="button" onClick={() => navigate('/logout')}>
                    <LogOut aria-hidden="true" />
                    {t('shell.signOut')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main id="main-content" className="seller-main">
          {consoleState.status === 'denied' ? (
            <MerchantAccessDenied
              backPath="/dashboard"
              title={t('merchantAccessDenied.unavailableTitle')}
              message={t('merchantAccessDenied.unavailableMessage')}
            />
          ) : consoleState.status === 'error' ? (
            <div className="space-y-2" role="alert" data-testid="merchant-console-error">
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('shell.consoleUnavailableTitle')}</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t('shell.consoleUnavailableMessage')}
              </p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
      </div>
    </SellerShellUserProvider>
  );
}
