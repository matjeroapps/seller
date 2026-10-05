'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, PauseCircle, PlayCircle, RefreshCw, Settings, ShieldCheck, Store as StoreIcon } from 'lucide-react';

import { sellerClient } from '@/lib/api/client';
import type { Store, StoreOperationalState } from '@/lib/api/types';

interface SettingsScreenProps {
  storeId: string;
}

function formatStatus(value?: string) {
  return value ? value.replace(/[_-]/g, ' ') : 'Unknown';
}

function formatDate(value?: string) {
  if (!value) return 'Not recorded yet';
  return new Date(value).toLocaleString();
}

function formatSettingsError(err: unknown) {
  const message = err instanceof Error ? err.message : 'Failed to load store settings.';
  return message === 'Actor authentication required'
    ? 'Your session could not be used to load store settings. Refresh the dashboard or sign in again.'
    : message;
}

export function SettingsScreen({ storeId }: SettingsScreenProps) {
  const [store, setStore] = useState<Store | null>(null);
  const [opState, setOpState] = useState<StoreOperationalState | null>(null);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const [storesRes, opRes] = await Promise.all([
        sellerClient.getStores(),
        sellerClient.getStoreOperationalState(storeId),
      ]);
      const currentStore = storesRes.items.find((item) => item.id === storeId);
      setStore(currentStore || null);
      setOpState(opRes);
      setMaintenanceMessage(opRes.maintenance_message || '');
    } catch (err: unknown) {
      setError(formatSettingsError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const [storesRes, opRes] = await Promise.all([
          sellerClient.getStores(),
          sellerClient.getStoreOperationalState(storeId),
        ]);
        if (!isMounted) return;
        const currentStore = storesRes.items.find((item) => item.id === storeId);
        setStore(currentStore || null);
        setOpState(opRes);
        setMaintenanceMessage(opRes.maintenance_message || '');
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(formatSettingsError(err));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    run();
    return () => {
      isMounted = false;
    };
  }, [storeId]);

  const persistOperationalState = async (nextAccepting: boolean, message: string) => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await sellerClient.updateStoreOperationalState(storeId, {
        checkout_status: nextAccepting ? 'accepting' : 'paused',
        maintenance_message: message,
      });
      setOpState(updated);
      setMaintenanceMessage(updated.maintenance_message || message);
      setSuccessMsg('Store checkout settings updated successfully.');
    } catch (err: unknown) {
      setError(formatSettingsError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCheckout = async () => {
    const accepting = opState?.checkout_accepting ?? true;
    const nextAccepting = !accepting;
    const nextMessage = nextAccepting
      ? ''
      : maintenanceMessage.trim() || 'Checkout is temporarily unavailable. Please try again later.';

    await persistOperationalState(nextAccepting, nextMessage);
  };

  const handleSaveMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    await persistOperationalState(opState?.checkout_accepting ?? true, maintenanceMessage.trim());
  };

  const checkoutAccepting = opState?.checkout_accepting ?? true;

  return (
    <div className="seller-dashboard">
      <section className="seller-dashboard-hero">
        <div>
          <div className="seller-dashboard-hero__eyebrow">
            <Settings aria-hidden="true" />
            <span>Store settings</span>
          </div>
          <div className="seller-dashboard-hero__title-row">
            <h1>{store?.name || 'Store settings'}</h1>
            <span className={`seller-status-badge seller-status-badge--${store?.status || 'neutral'}`}>
              {formatStatus(store?.status)}
            </span>
          </div>
          <div className="seller-dashboard-hero__meta">
            <span>{store?.market_code || 'Market loading'}</span>
            <span>{store?.code || 'Store code loading'}</span>
            <span>{checkoutAccepting ? 'Checkout accepting orders' : 'Checkout paused'}</span>
          </div>
        </div>
        <div className="seller-dashboard-hero__actions">
          <button type="button" onClick={loadSettings} disabled={loading || saving}>
            <RefreshCw aria-hidden="true" />
            Refresh settings
          </button>
        </div>
      </section>

      {error && (
        <div className="seller-alert seller-alert--danger" role="alert">
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="seller-alert seller-alert--warning" role="status">
          <CheckCircle2 aria-hidden="true" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="seller-dashboard__grid">
        <div className="seller-dashboard__main">
          <section className="seller-panel">
            <div className="seller-panel__header">
              <div>
                <span className="seller-section-kicker">Store profile</span>
                <h2>Identity details</h2>
              </div>
              <StoreIcon aria-hidden="true" />
            </div>

            {loading ? (
              <div className="seller-inline-empty">Loading store settings...</div>
            ) : (
              <div className="seller-settings-facts">
                <div>
                  <span>Store name</span>
                  <strong>{store?.name || 'Store not found'}</strong>
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
                <div>
                  <span>Created</span>
                  <strong>{formatDate(store?.created_at)}</strong>
                </div>
                <div>
                  <span>Last updated</span>
                  <strong>{formatDate(store?.updated_at)}</strong>
                </div>
              </div>
            )}
          </section>

          <form onSubmit={handleSaveMessage} className="seller-panel">
            <div className="seller-panel__header">
              <div>
                <span className="seller-section-kicker">Checkout operations</span>
                <h2>Storefront availability</h2>
              </div>
              <span className={`seller-checkout-pill ${checkoutAccepting ? 'seller-checkout-pill--active' : 'seller-checkout-pill--paused'}`}>
                {checkoutAccepting ? 'Accepting orders' : 'Checkout paused'}
              </span>
            </div>

            {loading ? (
              <div className="seller-inline-empty">Loading checkout status...</div>
            ) : (
              <>
                <div className="seller-checkout-summary">
                  <ShieldCheck aria-hidden="true" />
                  <div>
                    <strong>{checkoutAccepting ? 'Checkout is active' : 'Checkout is paused'}</strong>
                    <span>
                      {checkoutAccepting
                        ? 'Customers can complete purchases from this storefront.'
                        : 'Customers can browse the storefront, but checkout is currently disabled.'}
                    </span>
                  </div>
                </div>

                <label className="seller-settings-field">
                  <span>Customer-facing message</span>
                  <textarea
                    value={maintenanceMessage}
                    onChange={(event) => setMaintenanceMessage(event.target.value)}
                    maxLength={240}
                    rows={3}
                    placeholder="Checkout is temporarily unavailable. Please try again later."
                  />
                </label>

                <div className="seller-settings-actions">
                  <button type="submit" className="seller-secondary-link" disabled={saving || !opState}>
                    {saving ? 'Saving...' : 'Save message'}
                  </button>
                  <button type="button" className="seller-primary-action" onClick={handleToggleCheckout} disabled={saving || !opState}>
                    {checkoutAccepting ? <PauseCircle aria-hidden="true" /> : <PlayCircle aria-hidden="true" />}
                    {saving ? 'Updating...' : checkoutAccepting ? 'Pause checkout' : 'Resume checkout'}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>

        <aside className="seller-dashboard__rail">
          <section className="seller-panel">
            <div className="seller-panel__header">
              <div>
                <span className="seller-section-kicker">Operational summary</span>
                <h2>Current state</h2>
              </div>
              <ShieldCheck aria-hidden="true" />
            </div>
            <div className="seller-settings-rail">
              <div>
                <span>Checkout status</span>
                <strong>{opState?.checkout_status || 'accepting'}</strong>
              </div>
              <div>
                <span>State updated</span>
                <strong>{formatDate(opState?.updated_at)}</strong>
              </div>
              <div>
                <span>Updated by</span>
                <strong>{opState?.updated_by || 'System default'}</strong>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
