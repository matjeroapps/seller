'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, Store, UserRound, UsersRound } from 'lucide-react';

import { useSellerShellUser } from '@/components/shell/SellerShellContext';
import { sellerClient } from '@/lib/api/client';
import type { Store as SellerStore } from '@/lib/api/types';

type TeamScreenProps = {
  storeId: string;
};

function formatStatus(value?: string) {
  return value ? value.replace(/[_-]/g, ' ') : 'Unknown';
}

export function TeamScreen({ storeId }: TeamScreenProps) {
  const user = useSellerShellUser();
  const [store, setStore] = useState<SellerStore | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadStore() {
      setError(null);
      try {
        const stores = await sellerClient.getStores();
        if (!isMounted) return;
        setStore(stores.items.find((item) => item.id === storeId) || null);
      } catch (err: unknown) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : 'Failed to load team store context.';
        setError(
          message === 'Actor authentication required'
            ? 'Your session could not be used to load the store team context. Refresh the dashboard or sign in again.'
            : message
        );
      }
    }

    loadStore();
    return () => {
      isMounted = false;
    };
  }, [storeId]);

  const roles = user?.roles?.length ? user.roles : ['seller'];

  return (
    <div className="seller-dashboard">
      <section className="seller-dashboard-hero">
        <div>
          <div className="seller-dashboard-hero__eyebrow">
            <UsersRound aria-hidden="true" />
            <span>Team access</span>
          </div>
          <div className="seller-dashboard-hero__title-row">
            <h1>Team management</h1>
            <span className={`seller-status-badge seller-status-badge--${store?.status || 'neutral'}`}>
              {formatStatus(store?.status)}
            </span>
          </div>
          <div className="seller-dashboard-hero__meta">
            <span>{store?.name || 'Store context loading'}</span>
            <span>{store?.market_code || 'Market loading'}</span>
            <span>{roles[0]}</span>
          </div>
        </div>
      </section>

      {error && (
        <div className="seller-alert seller-alert--danger" role="alert">
          <span>{error}</span>
        </div>
      )}

      <div className="seller-dashboard__grid">
        <div className="seller-dashboard__main">
          <section className="seller-panel">
            <div className="seller-panel__header">
              <div>
                <span className="seller-section-kicker">Current access</span>
                <h2>Signed-in team member</h2>
              </div>
              <UserRound aria-hidden="true" />
            </div>

            <div className="seller-account-identity">
              <div className="seller-account-avatar">{(user?.name || 'Seller').slice(0, 2).toUpperCase()}</div>
              <div>
                <strong>{user?.name || 'Signed-in seller'}</strong>
                <span>{user?.email || 'No email address on the active session'}</span>
              </div>
            </div>

            <div className="seller-account-details">
              <div>
                <span>Account subject ID</span>
                <strong>{user?.id || 'Sign in again to refresh the account subject'}</strong>
              </div>
              <div>
                <span>Assigned roles</span>
                <div className="seller-role-list">
                  {roles.map((role) => (
                    <em key={role}>{role}</em>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="seller-panel">
            <div className="seller-panel__header">
              <div>
                <span className="seller-section-kicker">Store scope</span>
                <h2>Access boundary</h2>
              </div>
              <Store aria-hidden="true" />
            </div>

            <div className="seller-settings-facts">
              <div>
                <span>Store name</span>
                <strong>{store?.name || 'Store context pending'}</strong>
              </div>
              <div>
                <span>Store ID</span>
                <strong>{storeId}</strong>
              </div>
              <div>
                <span>Store code</span>
                <strong>{store?.code || 'Not assigned'}</strong>
              </div>
              <div>
                <span>Market code</span>
                <strong>{store?.market_code || 'Not assigned'}</strong>
              </div>
            </div>
          </section>
        </div>

        <aside className="seller-dashboard__rail">
          <section className="seller-panel">
            <div className="seller-panel__header">
              <div>
                <span className="seller-section-kicker">Identity security</span>
                <h2>Managed by MatjerHub SSO</h2>
              </div>
              <ShieldCheck aria-hidden="true" />
            </div>
            <p className="seller-account-note">
              User identity, authentication strength, and session security are controlled by MatjerHub SSO. Store access is shown here
              using the current authenticated account and seller role context.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
