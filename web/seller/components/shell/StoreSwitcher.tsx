'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Store as StoreIcon, ChevronDown, Plus, Check } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { Store } from '@/lib/api/types';
import type { MerchantWorkspaceStore } from '@/lib/api/merchant-console';

export function StoreSwitcher({
  currentStoreId,
  workspaceStores,
  workspaceMerchantId
}: {
  currentStoreId?: string;
  // When a merchant workspace is selected, the switcher is scoped to that
  // workspace's authorized stores and navigates the canonical store paths.
  workspaceStores?: MerchantWorkspaceStore[];
  workspaceMerchantId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [stores, setStores] = useState<Store[]>([]);
  const [activeLimit, setActiveLimit] = useState<number>(1);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [newStoreName, setNewStoreName] = useState<string>('');
  const [newStoreCode, setNewStoreCode] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    sellerApi
      .getStores()
      .then((data) => {
        if (!isMounted) return;
        setStores(data.items || []);
        setActiveLimit(data.active_store_limit || 1);
        setActiveCount(data.active_store_count || 0);
        setLoading(false);

        // Store selection logic if no store is selected in route
        if (!currentStoreId && pathname !== '/dashboard' && !pathname.startsWith('/dashboard/merchants/') && data.items && data.items.length > 0) {
          const activeStores = data.items.filter((s) => s.status === 'active');
          const targetStore = activeStores.length > 0 ? activeStores[0] : data.items[0];
          if (targetStore) {
            const nextPath = pathname.startsWith('/dashboard/stores/')
              ? pathname
              : `/dashboard/stores/${targetStore.id}`;
            router.replace(nextPath);
          }
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentStoreId, pathname, router]);

  const selectedStore = workspaceStores
    ? workspaceStores.find((s) => s.id === currentStoreId) || workspaceStores[0]
    : stores.find((s) => s.id === currentStoreId) || stores[0];

  const handleSelectStore = (storeId: string) => {
    setIsOpen(false);
    if (workspaceMerchantId) {
      // Canonical store paths inside the selected merchant workspace; a store
      // of another workspace is never offered here.
      router.push(`/dashboard/merchants/${workspaceMerchantId}/stores/${storeId}`);
      return;
    }
    if (currentStoreId) {
      const newPath = pathname.replace(`/dashboard/stores/${currentStoreId}`, `/dashboard/stores/${storeId}`);
      router.push(newPath);
    } else {
      router.push(`/dashboard/stores/${storeId}`);
    }
  };

  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName || !newStoreCode) return;
    setCreateError(null);
    try {
      const workspace = workspaceMerchantId
        ? { id: workspaceMerchantId }
        : await sellerApi.ensureRetailWorkspace({
            code: `merchant-${newStoreCode}`,
            legal_name: newStoreName
          });
      const merchantId = workspace.id;
      const created = await sellerApi.createStore({
        name: newStoreName,
        code: newStoreCode,
        market_code: 'SA',
        merchant_id: merchantId
      });
      setCreating(false);
      setNewStoreName('');
      setNewStoreCode('');
      setStores((prev) => [...prev, created]);
      setIsOpen(false);
      router.push(`/dashboard/merchants/${merchantId}/stores/${created.id}`);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create store');
    }
  };

  if (loading && !workspaceStores) {
    return (
      <button
        type="button"
        disabled
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 rounded border border-slate-200 animate-pulse cursor-not-allowed opacity-75"
      >
        <StoreIcon className="w-4 h-4" /> Loading stores...
      </button>
    );
  }

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-md shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
        aria-expanded={isOpen}
        data-testid="store-switcher"
      >
        <StoreIcon className="w-4 h-4 text-slate-600" />
        <span className="truncate max-w-[140px]">{selectedStore ? selectedStore.name : 'Select Store'}</span>
        {selectedStore && (
          <span
            className={`px-1.5 py-0.5 text-[10px] font-semibold rounded uppercase ${
              selectedStore.status === 'active'
                ? 'bg-emerald-100 text-emerald-800'
                : selectedStore.status === 'draft'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {selectedStore.status}
          </span>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-50 mt-1 w-64 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 divide-y divide-slate-100 focus:outline-none">
          <div className="p-2">
            <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-500 font-semibold">
              <span>Stores</span>
              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-medium text-slate-600">
                Active: {activeCount} / {activeLimit}
              </span>
            </div>
            <div className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">
              {(workspaceStores || stores).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectStore(s.id)}
                  data-store-id={s.id}
                  data-testid={`store-switcher-option-${s.code}`}
                  className={`w-full flex items-center justify-between px-2.5 py-2 text-xs rounded-md text-left transition-colors ${
                    s.id === selectedStore?.id ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="truncate pr-2">
                    <div className="truncate font-medium">{s.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{s.code} · {s.market_code}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase ${
                        s.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : s.status === 'draft'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {s.status}
                    </span>
                    {s.id === selectedStore?.id && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="p-2">
            {!creating ? (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-md border border-slate-200"
              >
                <Plus className="w-3.5 h-3.5" /> Create Store
              </button>
            ) : (
              <form onSubmit={handleCreateStore} className="space-y-2 p-1">
                {createError && (
                  <div className="text-[11px] text-rose-600 bg-rose-50 p-1.5 rounded border border-rose-200">
                    {createError}
                  </div>
                )}
                <input
                  type="text"
                  placeholder="Store Name"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                  required
                />
                <input
                  type="text"
                  placeholder="Store Code (e.g. store-a)"
                  value={newStoreCode}
                  onChange={(e) => setNewStoreCode(e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                  required
                />
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="px-2 py-1 text-[11px] text-slate-600 hover:underline"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-2.5 py-1 text-[11px] font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700"
                  >
                    Save
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
