import React from 'react';
import { createRoot } from 'react-dom/client';
import { createOidcAuthClient, type AuthState } from './auth/oidc';
import { createApiClient } from './lib/api';
import { directionFor, messages, type Locale } from './i18n/locales';
import { Router } from './routes/Router';
import '@matjerhub/ui/styles.css';
import {
  DashboardLayout,
  sellerNavigation,
  AnonymousState,
  LoadingState,
  ErrorState,
  Card,
  CardTitle,
  Button,
  Input,
} from '@matjerhub/ui';
import './styles.css';

type Bootstrap = {
  actor: string;
  direction: 'rtl' | 'ltr';
  principal?: { subject: string; preferred_username?: string };
  markets: Array<{ code: string; country: { name: string }; currency: { code: string } }>;
};

type Seller = { id: string; code: string; name: string; status: string };
type Store = { id: string; seller_id: string; market_code: string; code: string; name: string; status: string };
type Offer = { offer_id?: string; id?: string; market_code: string; supplier_name?: string; supplier_code?: string; product_name?: string; status: string; price?: { amount_minor: number; currency: string } | null };
type Listing = { id: string; store_id: string; product_id: string; market_code: string; status: string };

const localeParam = new URLSearchParams(window.location.search).get('locale');
const locale: Locale = localeParam === 'ar' ? 'ar' : 'en';
const copy = messages[locale];

document.documentElement.lang = locale;
document.documentElement.dir = directionFor(locale);

const authClient = createOidcAuthClient();
const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? window.location.origin,
  getAccessToken: () => authClient.getAccessToken(),
  renewToken: () => authClient.renewToken(),
  onUnauthorized: () => {
    void authClient.clearSession();
  }
});

function App() {
  const [authState, setAuthState] = React.useState<AuthState>(authClient.getState());
  const [bootstrap, setBootstrap] = React.useState<Bootstrap | null>(null);
  const [seller, setSeller] = React.useState<Seller | null>(null);
  const [stores, setStores] = React.useState<Store[]>([]);
  const [offers, setOffers] = React.useState<Offer[]>([]);
  const [listings, setListings] = React.useState<Listing[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const [profileName, setProfileName] = React.useState('');
  const [profileStatus, setProfileStatus] = React.useState('active');
  const [profileSettings, setProfileSettings] = React.useState('{"channel":"retail"}');
  const [storeForm, setStoreForm] = React.useState({ market_code: 'EG', code: '', name: '', status: 'active' });
  const [catalogForm, setCatalogForm] = React.useState({ store_id: '', market_code: 'EG', supplier_id: '', category_id: '', search: '' });
  const [listingForm, setListingForm] = React.useState({ store_id: '', product_id: '', supplier_offer_id: '', market_code: 'EG', status: 'draft' });
  const [priceForm, setPriceForm] = React.useState({ amount_minor: 0, currency: 'EGP' });
  const [currentPath, setCurrentPath] = React.useState(window.location.pathname || '/dashboard');

  React.useEffect(() => {
    return authClient.subscribe((state) => {
      setAuthState(state);
    });
  }, []);

  const loadSellerData = React.useCallback(async () => {
    if (!authState.isAuthenticated) return;
    try {
      setLoading(true);
      setError(null);
      const [bootRes, profileRes, storesRes] = await Promise.all([
        api.get(`/v1/bootstrap?locale=${locale}`),
        api.get(`/v1/seller/profile?locale=${locale}`),
        api.get(`/v1/seller/stores?locale=${locale}`)
      ]);

      if (bootRes.ok) setBootstrap(await bootRes.json());
      if (profileRes.ok) {
        const profile = (await profileRes.json()) as { seller: Seller };
        setSeller(profile.seller);
        setProfileName(profile.seller.name || '');
        setProfileStatus(profile.seller.status || 'active');
      }
      if (storesRes.ok) {
        const storeItems = ((await storesRes.json()) as { items: Store[] }).items || [];
        setStores(storeItems);
        if (storeItems[0]) {
          setCatalogForm((current) => ({ ...current, store_id: storeItems[0].id }));
          const offersResponse = await api.get(`/v1/seller/listings?store_id=${encodeURIComponent(storeItems[0].id)}&locale=${locale}`);
          if (offersResponse.ok) {
            setListings(((await offersResponse.json()) as { items: Listing[] }).items || []);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load seller dashboard data');
    } finally {
      setLoading(false);
    }
  }, [authState.isAuthenticated]);

  React.useEffect(() => {
    void loadSellerData();
  }, [loadSellerData]);

  async function submitProfile() {
    try {
      const response = await api.put(`/v1/seller/profile?locale=${locale}`, {
        name: profileName,
        status: profileStatus,
        settings: JSON.parse(profileSettings || '{}')
      });
      if (!response.ok) throw new Error('Profile update failed');
      await loadSellerData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profile update failed');
    }
  }

  async function submitStore() {
    try {
      const response = await api.post(`/v1/seller/stores?locale=${locale}`, storeForm);
      if (!response.ok) throw new Error('Store create failed');
      setStoreForm({ market_code: 'EG', code: '', name: '', status: 'active' });
      await loadSellerData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Store create failed');
    }
  }

  async function loadOffers() {
    try {
      const query = new URLSearchParams({
        store_id: catalogForm.store_id,
        supplier_id: catalogForm.supplier_id,
        category_id: catalogForm.category_id,
        search: catalogForm.search,
        locale
      });
      const response = await api.get(`/v1/seller/catalog/offers?${query.toString()}`);
      if (!response.ok) throw new Error('Offer discovery failed');
      const data = (await response.json()) as { items: Offer[] };
      setOffers(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Offer discovery failed');
    }
  }

  async function importListing() {
    try {
      const response = await api.post(`/v1/seller/listings/import?locale=${locale}`, listingForm);
      if (!response.ok) throw new Error('Listing import failed');
      await loadSellerData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Listing import failed');
    }
  }

  async function updatePrice(listingId: string) {
    try {
      const response = await api.post(`/v1/seller/listings/${listingId}/price?locale=${locale}`, priceForm);
      if (!response.ok) throw new Error('Listing price update failed');
      await loadSellerData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Listing price update failed');
    }
  }

  if (!authState.isAuthenticated) {
    return (
      <AnonymousState
        appName="Seller Portal"
        onSignIn={() => void authClient.login()}
      />
    );
  }

  const renderDashboardContent = (_selectedStoreId: string, _onSelectStore: (id: string) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {error ? <ErrorState message={error} onRetry={() => void loadSellerData()} /> : null}
      {loading ? <LoadingState title={copy.status || 'Loading...'} /> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <Card variant="glass">
          <CardTitle>Seller Profile</CardTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            <Input label="Seller Name" value={profileName} onChange={(e) => setProfileName(e.target.value)} />
            <Input label="Status" value={profileStatus} onChange={(e) => setProfileStatus(e.target.value)} />
            <Button onClick={() => void submitProfile()}>Save Profile</Button>
          </div>
        </Card>

        <Card variant="glass">
          <CardTitle>Create Store</CardTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            <Input label="Market Code" value={storeForm.market_code} onChange={(e) => setStoreForm({ ...storeForm, market_code: e.target.value })} />
            <Input label="Store Name" value={storeForm.name} onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })} />
            <Button onClick={() => void submitStore()}>Create Store</Button>
          </div>
        </Card>
      </div>

      <Router
        authClient={authClient}
        api={api}
        locale={locale}
        copy={copy}
        renderDashboard={() => null}
        stores={stores}
      />
    </div>
  );

  const workspaces = stores.map((s) => ({ id: s.id, name: s.name, type: 'seller' as const }));

  return (
    <DashboardLayout
      appTitle="MatjerHub Seller"
      navItems={sellerNavigation}
      currentPath={currentPath}
      onNavigate={(path) => {
        setCurrentPath(path);
        window.history.pushState({}, '', path);
      }}
      workspaces={workspaces.length ? workspaces : [{ id: 'default', name: seller?.name || 'Seller Store', type: 'seller' }]}
      user={{
        name: authState.user?.preferred_username || bootstrap?.principal?.preferred_username || 'Seller User',
        email: authState.user?.email || 'seller@matjerhub.com',
        role: bootstrap?.actor || 'Seller Admin',
      }}
      onSignOut={() => void authClient.logout()}
    >
      {renderDashboardContent('', () => {})}
    </DashboardLayout>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
