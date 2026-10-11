'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Store as StoreIcon, ChevronDown, Check } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { Store } from '@/lib/api/types';
import type { MerchantWorkspaceStore } from '@/lib/api/merchant-console';
import { useTranslation } from '@/lib/i18n/locale-context';

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
  const { t } = useTranslation();

  const [stores, setStores] = useState<Store[]>([]);
  const [activeLimit, setActiveLimit] = useState<number>(1);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [isOpen, setIsOpen] = useState<boolean>(false);

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

  // Only the URL-selected store is "current". There is no fallback: before the
  // route selects a store (or if the routed store is stale/not authorized for
  // this workspace) the switcher shows an explicit unselected state while the
  // authorized store listing stays navigable.
  const selectedStore = currentStoreId
    ? workspaceStores
      ? workspaceStores.find((s) => s.id === currentStoreId)
      : stores.find((s) => s.id === currentStoreId)
    : undefined;

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

  if (loading && !workspaceStores) {
    return (
      <button
        type="button"
        disabled
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 rounded border border-slate-200 dark:border-slate-700 animate-pulse cursor-not-allowed opacity-75"
      >
        <StoreIcon className="w-4 h-4" /> {t('storeSwitcher.loadingStores')}
      </button>
    );
  }

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
        aria-expanded={isOpen}
        data-testid="store-switcher"
      >
        <StoreIcon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        <span className="truncate max-w-[140px]">{selectedStore ? selectedStore.name : t('storeSwitcher.selectStore')}</span>
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
            {t(`statuses.${selectedStore.status}`, selectedStore.status)}
          </span>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-50 mt-1 w-64 rounded-md bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black dark:ring-slate-700 ring-opacity-5 divide-y divide-slate-100 dark:divide-slate-800 focus:outline-none">
          <div className="p-2">
            <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-500 dark:text-slate-400 font-semibold">
              <span>{t('storeSwitcher.stores')}</span>
              <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-medium text-slate-600 dark:text-slate-300">
                {t('storeSwitcher.activeCount').replace('{active}', String(activeCount)).replace('{limit}', String(activeLimit))}
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
                    s.id === selectedStore?.id ? 'bg-slate-100 dark:bg-slate-800 font-medium text-slate-900 dark:text-slate-50' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="truncate pr-2">
                    <div className="truncate font-medium">{s.name}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate"><span className="mh-ltr-token" dir="ltr">{s.code} · {s.market_code}</span></div>
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
                      {t(`statuses.${s.status}`, s.status)}
                    </span>
                    {s.id === selectedStore?.id && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
