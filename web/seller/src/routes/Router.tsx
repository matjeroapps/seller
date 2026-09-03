import React from 'react';
import type { AuthClient, AuthState } from '../auth/oidc';
import type { ApiClient } from '../lib/api';
import { ThemeCatalog } from '../components/ThemeCatalog';
import { ThemeEditorPanel } from '../components/ThemeEditorPanel';
import { DomainManagementPanel } from '../components/DomainManagementPanel';

type RouteLocation =
  | { path: '/'; params: {} }
  | { path: '/themes'; params: {} }
  | { path: '/stores/theme'; params: { storeId: string } }
  | { path: '/stores/domains'; params: { storeId: string } }
  | { path: '/auth/callback'; params: {} };

type RouterProps = {
  authClient: AuthClient;
  api: ApiClient;
  locale: string;
  copy: Record<string, string>;
  renderDashboard: (selectedStoreId: string, onSelectStore: (id: string) => void) => React.ReactNode;
  stores: Array<{ id: string; name: string; code: string; market_code: string }>;
};

export function Router({
  authClient,
  api,
  locale,
  copy,
  renderDashboard,
  stores
}: RouterProps) {
  const [authState, setAuthState] = React.useState<AuthState>(authClient.getState());
  const [currentRoute, setCurrentRoute] = React.useState<RouteLocation>(() => parseLocation(window.location.hash, window.location.pathname));
  const [selectedStoreId, setSelectedStoreId] = React.useState<string>('');
  const [callbackStatus, setCallbackStatus] = React.useState<'processing' | 'success' | 'error'>('processing');
  const [callbackError, setCallbackError] = React.useState<string | null>(null);

  React.useEffect(() => {
    return authClient.subscribe((state) => {
      setAuthState(state);
    });
  }, [authClient]);

  React.useEffect(() => {
    const handleLocationChange = () => {
      setCurrentRoute(parseLocation(window.location.hash, window.location.pathname));
    };
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  // Update selected store ID when stores load
  React.useEffect(() => {
    if (stores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id);
    }
  }, [stores, selectedStoreId]);

  // Handle Callback Route
  React.useEffect(() => {
    if (currentRoute.path === '/auth/callback') {
      let active = true;
      async function processCallback() {
        try {
          const returnPath = await authClient.handleCallback(window.location.href);
          if (active) {
            setCallbackStatus('success');
            const targetHash = returnPath ? (returnPath.startsWith('#') ? returnPath : `#${returnPath.startsWith('/') ? returnPath : '/' + returnPath}`) : '#/';
            window.history.replaceState(null, '', `/${targetHash}`);
            setCurrentRoute(parseLocation(window.location.hash, window.location.pathname));
          }
        } catch (err) {
          if (active) {
            setCallbackStatus('error');
            setCallbackError(err instanceof Error ? err.message : 'Callback handling failed');
          }
        }
      }
      void processCallback();
      return () => {
        active = false;
      };
    }
  }, [currentRoute, authClient]);

  const navigate = (hash: string) => {
    window.location.hash = hash;
  };

  if (currentRoute.path === '/auth/callback') {
    return (
      <div className="app-container center-container">
        {callbackStatus === 'processing' ? (
          <div className="notice">{copy.authenticating || 'Completing authentication...'}</div>
        ) : callbackStatus === 'error' ? (
          <div className="notice notice-error">
            <p>{callbackError}</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                window.history.replaceState(null, '', '/#/');
                setCurrentRoute(parseLocation('#/', '/'));
              }}
            >
              {copy.returnToDashboard || 'Return to Dashboard'}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  // Auth Guard
  if (authState.isLoading) {
    return <div className="notice">{copy.checkingAuth || 'Checking session...'}</div>;
  }

  if (!authState.isAuthenticated) {
    return (
      <div className="unauthenticated-screen">
        <div className="login-card">
          <h1>{copy.appName || 'Seller Dashboard'}</h1>
          <p>{copy.loginPrompt || 'Please sign in with your ZITADEL account to manage your stores and themes.'}</p>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => void authClient.login(window.location.hash.slice(1))}>
            {copy.signIn || 'Sign In with ZITADEL'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="router-container">
      <nav className="seller-subnav" aria-label="Seller Dashboard Navigation">
        <div className="subnav-links">
          <button
            type="button"
            className={`nav-tab ${currentRoute.path === '/' ? 'active' : ''}`}
            onClick={() => navigate('#/')}
          >
            {copy.dashboard || 'Dashboard'}
          </button>
          <button
            type="button"
            className={`nav-tab ${currentRoute.path === '/themes' ? 'active' : ''}`}
            onClick={() => navigate('#/themes')}
          >
            {copy.themeCatalog || 'Theme Catalog'}
          </button>
          <button
            type="button"
            className={`nav-tab ${currentRoute.path === '/stores/theme' ? 'active' : ''}`}
            onClick={() => navigate(`#/stores/${selectedStoreId || 'select'}/theme`)}
          >
            {copy.storeThemeManagement || 'Store Theme'}
          </button>
          <button
            type="button"
            className={`nav-tab ${currentRoute.path === '/stores/domains' ? 'active' : ''}`}
            onClick={() => navigate(`#/stores/${selectedStoreId || 'select'}/domains`)}
          >
            {copy.domainsNav || 'Store Domains'}
          </button>
        </div>

        <div className="subnav-actions">
          {stores.length > 0 ? (
            <div className="store-selector-inline">
              <label htmlFor="store-select">{copy.activeStore || 'Active Store'}:</label>
              <select
                id="store-select"
                value={selectedStoreId}
                onChange={(e) => {
                  const newStoreId = e.target.value;
                  setSelectedStoreId(newStoreId);
                  if (currentRoute.path === '/stores/theme') {
                    navigate(`#/stores/${newStoreId}/theme`);
                  } else if (currentRoute.path === '/stores/domains') {
                    navigate(`#/stores/${newStoreId}/domains`);
                  }
                }}
                className="form-control form-control-sm"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      </nav>

      <main className="route-content">
        {currentRoute.path === '/' ? (
          renderDashboard(selectedStoreId, setSelectedStoreId)
        ) : currentRoute.path === '/themes' ? (
          <ThemeCatalog
            api={api}
            selectedStoreId={selectedStoreId}
            onThemeInstalled={() => navigate(`#/stores/${selectedStoreId}/theme`)}
            locale={locale}
            copy={copy}
          />
        ) : currentRoute.path === '/stores/theme' ? (
          <ThemeEditorPanel
            api={api}
            storeId={currentRoute.params.storeId || selectedStoreId}
            locale={locale}
            copy={copy}
            onNavigateCatalog={() => navigate('#/themes')}
          />
        ) : currentRoute.path === '/stores/domains' ? (
          <DomainManagementPanel
            api={api}
            storeId={currentRoute.params.storeId || selectedStoreId}
            locale={locale}
            copy={copy}
          />
        ) : null}
      </main>
    </div>
  );
}

export function parseLocation(hash: string = window.location.hash, pathname: string = window.location.pathname): RouteLocation {
  const cleanPathname = pathname.replace(/\/$/, '');
  if (cleanPathname === '/auth/callback') {
    return { path: '/auth/callback', params: {} };
  }
  const cleanHash = hash.replace(/^#/, '').replace(/\/$/, '');
  if (cleanHash === '/auth/callback') {
    return { path: '/auth/callback', params: {} };
  }
  if (cleanHash === '/themes') {
    return { path: '/themes', params: {} };
  }
  const storeThemeMatch = cleanHash.match(/^\/stores\/([^/]+)\/theme$/);
  if (storeThemeMatch) {
    return { path: '/stores/theme', params: { storeId: storeThemeMatch[1] } };
  }
  const storeDomainMatch = cleanHash.match(/^\/stores\/([^/]+)\/domains$/);
  if (storeDomainMatch) {
    return { path: '/stores/domains', params: { storeId: storeDomainMatch[1] } };
  }
  return { path: '/', params: {} };
}
