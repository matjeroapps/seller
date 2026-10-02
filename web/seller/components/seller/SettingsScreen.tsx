'use client';

import React, { useEffect, useState } from 'react';
import { sellerClient } from '@/lib/api/client';
import type { Store, StoreOperationalState } from '@/lib/api/types';
import { CapabilityState } from './CapabilityState';
import { createUnavailableState } from '@/lib/screens/state';
import { Settings, Store as StoreIcon, ShieldAlert } from 'lucide-react';

interface SettingsScreenProps {
  storeId: string;
}

export function SettingsScreen({ storeId }: SettingsScreenProps) {
  const [store, setStore] = useState<Store | null>(null);
  const [opState, setOpState] = useState<StoreOperationalState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingCheckout, setUpdatingCheckout] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [storeId]);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const [storesRes, opRes] = await Promise.all([
        sellerClient.getStores(),
        sellerClient.getStoreOperationalState(storeId),
      ]);
      const currentStore = storesRes.items.find((s) => s.id === storeId);
      setStore(currentStore || null);
      setOpState(opRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load store settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCheckout = async () => {
    if (!opState) return;
    setUpdatingCheckout(true);
    const nextAccepting = !opState.checkout_accepting;
    try {
      const updated = await sellerClient.updateStoreOperationalState(storeId, {
        checkout_status: nextAccepting ? 'accepting' : 'paused',
        maintenance_message: nextAccepting ? '' : 'Store checkout temporarily paused by seller.',
      });
      setOpState(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to update store operational state.');
    } finally {
      setUpdatingCheckout(false);
    }
  };

  if (loading) {
    return (
      <CapabilityState
        state={{
          status: 'loading',
          title: 'Loading Store Settings',
          description: 'Fetching store configuration and operational details...',
        }}
      />
    );
  }

  const taxPolicyState = createUnavailableState(
    'Tax Rules & Custom Legal Policies',
    'Custom VAT rules, tax registration documents, and localized store return/refund policy editors are not supported by Core.'
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Store Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          View store identity details and manage checkout availability.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-rose-50 p-4 border border-rose-200 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border bg-white p-6 shadow-sm dark:bg-slate-900 space-y-4">
        <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white border-b pb-3">
          <StoreIcon className="h-5 w-5 text-primary-600" />
          Store Profile & Operational Facts
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Store Name</label>
            <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{store?.name || storeId}</div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Store ID</label>
            <div className="mt-1 text-xs font-mono text-slate-600 dark:text-slate-400">{storeId}</div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Market Code</label>
            <div className="mt-1 text-sm text-slate-900 dark:text-white">{store?.market_code || 'SA'}</div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Store Status</label>
            <div className="mt-1">
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                {store?.status || 'active'}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Storefront Checkout Status</h4>
              <p className="text-xs text-slate-500">
                {opState?.checkout_accepting ? 'Checkout is active and accepting buyer orders.' : 'Checkout is paused.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleCheckout}
              disabled={updatingCheckout}
              className={`rounded-md px-3.5 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-50 ${
                opState?.checkout_accepting ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {updatingCheckout
                ? 'Updating...'
                : opState?.checkout_accepting
                ? 'Pause Store Checkout'
                : 'Resume Store Checkout'}
            </button>
          </div>

          {opState?.maintenance_message && (
            <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200">
              Notice: {opState.maintenance_message}
            </div>
          )}
        </div>
      </div>

      <CapabilityState state={taxPolicyState} />
    </div>
  );
}
