'use client';

import { useCallback, useEffect, useRef, useState, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Archive,
  ArrowDownUp,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CloudDownload,
  Columns3,
  Filter,
  Grid2X2,
  ImageIcon,
  List,
  Package,
  Plus,
  RefreshCw,
  Tag,
  Trash2
} from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { Product } from '@/lib/api/types';
import { useTranslation } from '@/lib/i18n/locale-context';
import { formatMoney } from '@/lib/money';
import { ConfirmModal } from '@/components/seller/ConfirmModal';

type ProductView = 'list' | 'grid';

const PAGE_SIZE = 20;
const SELECTION_CAP = 100;
const SEARCH_DEBOUNCE_MS = 250;

function formatDate(value: string | undefined, fallbackText: string) {
  if (!value) return fallbackText;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallbackText : date.toLocaleDateString();
}

function productImage(product: Product, mediaByProductId: Record<string, string>) {
  return product.primary_media_uri || mediaByProductId[product.id] || '';
}

function readinessLabel(product: Product, readyText: string, notCheckedText: string) {
  if (product.publish_readiness?.is_ready) return readyText;
  if (product.publish_readiness?.reasons?.[0]) return product.publish_readiness.reasons[0];
  return notCheckedText;
}

function listingStatusLabel(status: string, t: (key: string) => string) {
  const labels: Record<string, string> = {
    active: t('common.active'),
    draft: t('statuses.draft'),
    published: t('products.statusPublished'),
    unpublished: t('products.statusUnpublished'),
    archived: t('common.archived')
  };
  return labels[status] || status;
}

function ProductImagePreview({
  src,
  alt,
  className,
  iconClassName,
  noImageLabel
}: {
  src: string;
  alt: string;
  className: string;
  iconClassName: string;
  noImageLabel: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div className={`${className} bg-slate-100`} role="img" aria-label={noImageLabel} data-testid="product-image">
        <ImageIcon className={iconClassName} aria-hidden="true" />
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} data-testid="product-image" onError={() => setFailed(true)} />;
}

export default function StoreProductsPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = use(params);
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [mediaByProductId, setMediaByProductId] = useState<Record<string, string>>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [searchInput, setSearchInput] = useState(() => searchParams.get('query') || '');
  const [committedQuery, setCommittedQuery] = useState(() => searchParams.get('query') || '');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'seller_owned' | 'supplier_backed'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [view, setView] = useState<ProductView>('list');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [pendingRemovalIds, setPendingRemovalIds] = useState<string[]>([]);
  const [removingProducts, setRemovingProducts] = useState(false);
  const [removalNotice, setRemovalNotice] = useState<string | null>(null);
  const [removalError, setRemovalError] = useState<string | null>(null);
  const requestId = useRef(0);
  const hasLoaded = useRef(false);
  // `t` is re-created per render outside LocaleProvider (test fallback);
  // keep it out of the fetch identity to avoid refetch loops.
  const tRef = useRef(t);
  tRef.current = t;

  // Keep the toolbar search in sync with shell-driven ?query= navigation.
  // Guarded by value (not identity): searchParams objects are re-created
  // per render, so only a changed query value triggers a sync.
  const syncedQuery = useRef<string | null>(null);
  useEffect(() => {
    const incoming = searchParams.get('query') || '';
    if (syncedQuery.current === incoming) return;
    syncedQuery.current = incoming;
    setSearchInput(incoming);
    setCommittedQuery(incoming);
    setPage(0);
  }, [searchParams]);

  // Debounce free-typed search into a committed server query.
  useEffect(() => {
    const timer = setTimeout(() => {
      setCommittedQuery((current) => (current === searchInput ? current : searchInput));
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchProducts = useCallback(async () => {
    const currentRequest = ++requestId.current;
    if (!hasLoaded.current) setInitialLoading(true);
    else setRefreshing(true);
    setLoadError(null);
    try {
      const res = await sellerApi.listStoreProducts(store_id, {
        query: committedQuery,
        status: statusFilter,
        source: sourceFilter,
        limit: pageSize,
        offset: page * pageSize
      });
      if (requestId.current !== currentRequest) return;
      setProducts(res.items || []);
      setTotal(res.total ?? (res.items || []).length);
    } catch {
      if (requestId.current !== currentRequest) return;
      setLoadError(tRef.current('products.errorLoadProducts'));
    } finally {
      if (requestId.current === currentRequest) {
        hasLoaded.current = true;
        setInitialLoading(false);
        setRefreshing(false);
      }
    }
  }, [store_id, page, pageSize, committedQuery, sourceFilter, statusFilter, retryToken]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Step back when the current page becomes empty but results remain.
  useEffect(() => {
    if (!initialLoading && !refreshing && !loadError && products.length === 0 && total > 0 && page > 0) {
      setPage((current) => Math.max(0, current - 1));
    }
  }, [initialLoading, refreshing, loadError, products.length, total, page]);

  // Resolve display images: primary media, media references, legacy detail.
  useEffect(() => {
    let isMounted = true;
    if (products.length === 0) {
      setMediaByProductId({});
      return () => {
        isMounted = false;
      };
    }
    (async () => {
      const mediaEntries = await Promise.all(
        products.map(async (product) => {
          if (product.primary_media_uri) return [product.id, product.primary_media_uri] as const;
          let referenceImage = '';
          try {
            const media = await sellerApi.listProductMediaReferences(store_id, product.id);
            referenceImage = media.items.find((reference) => reference.is_primary)?.url || media.items[0]?.url || '';
          } catch {
            // Fall back to legacy product media below for older catalog records.
          }
          if (referenceImage) return [product.id, referenceImage] as const;
          try {
            const detail = await sellerApi.getStoreProductDetail(store_id, product.id);
            const legacyImage = detail.primary_media_uri || detail.media?.find((media) => media.is_primary)?.uri || detail.media?.[0]?.uri;
            return legacyImage ? ([product.id, legacyImage] as const) : null;
          } catch {
            return null;
          }
        })
      );
      if (isMounted) {
        setMediaByProductId(Object.fromEntries(mediaEntries.filter((entry): entry is readonly [string, string] => Boolean(entry))));
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [products, store_id]);

  const selectedVisibleCount = products.filter((product) => selectedProductIds.has(product.id)).length;
  const allVisibleSelected = products.length > 0 && selectedVisibleCount === products.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : page * pageSize + 1;
  const rangeEnd = Math.min((page + 1) * pageSize, total);
  const activeCount = products.filter((product) => (product.listing_status || product.status) === 'active' || product.listing_status === 'published').length;
  const draftCount = products.filter((product) => (product.listing_status || product.status) === 'draft').length;
  const archivedCount = products.filter((product) => (product.listing_status || product.status) === 'archived').length;
  const lowStockProducts = products.filter((product) => (product.inventory_summary?.total_available ?? 0) <= 5);
  const supplierCount = products.filter((product) => product.source === 'supplier_backed').length;
  const outOfStockCount = products.filter((product) => (product.inventory_summary?.total_available ?? 0) <= 0).length;

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else if (next.size < SELECTION_CAP) next.add(productId);
      return next;
    });
  };

  const toggleVisibleSelection = () => {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) products.forEach((product) => next.delete(product.id));
      else {
        for (const product of products) {
          if (next.size >= SELECTION_CAP) break;
          next.add(product.id);
        }
      }
      return next;
    });
  };

  const confirmProductRemoval = async () => {
    if (pendingRemovalIds.length === 0) return;
    setRemovingProducts(true);
    setRemovalNotice(null);
    setRemovalError(null);
    try {
      const response = pendingRemovalIds.length === 1
        ? await sellerApi.removeStoreProduct(store_id, pendingRemovalIds[0])
        : await sellerApi.bulkRemoveStoreProducts(store_id, pendingRemovalIds);
      const results = response.results || [];
      const removedCount = results.filter((item) => item.outcome === 'removed' || item.outcome === 'not_found').length;
      const archivedCount = results.filter((item) => item.outcome === 'archived').length;
      const failedResults = results.filter((item) => item.outcome === 'failed');
      setRemovalNotice(
        t('products.removalSummary')
          .replace('{removed}', String(removedCount))
          .replace('{archived}', String(archivedCount))
          .replace('{failed}', String(failedResults.length))
      );
      if (failedResults.length > 0) setRemovalError(t('products.removalSomeFailed'));
      setSelectedProductIds(new Set(failedResults.map((item) => item.product_id)));
      setPendingRemovalIds([]);
      setRetryToken((token) => token + 1);
    } catch (error: any) {
      setRemovalError(error.message || t('products.errorRemoveProducts'));
    } finally {
      setRemovingProducts(false);
    }
  };

  return (
    <div className="space-y-6 bg-[#faf8ff]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#131b2e]">{t('products.catalogTitle')}</h1>
          <p className="text-sm text-[#6f7974] mt-1">{t('products.catalogSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/stores/${store_id}/catalog/supplier-offers`}
            className="inline-flex items-center gap-1.5 px-4 h-10 text-sm font-semibold text-[#131b2e] bg-white border border-[#e2dfeb] rounded-lg hover:bg-[#f3f1fa]"
          >
            <CloudDownload className="h-4 w-4 text-[#0d5c46]" />
            {t('products.importSupplierOffer')}
          </Link>
          <button type="button" className="inline-flex items-center gap-1.5 px-4 h-10 text-sm font-semibold text-[#131b2e] bg-white border border-[#e2dfeb] rounded-lg hover:bg-[#f3f1fa]">
            <ArrowDownUp className="h-4 w-4 text-[#6f7974]" /> {t('products.exportImport')}
          </button>
          <Link
            href={`/dashboard/stores/${store_id}/catalog/products/new`}
            data-testid="product-create"
            className="flex items-center gap-1.5 px-4 h-10 text-sm font-semibold text-white bg-[#0d5c46] rounded-lg hover:bg-[#094434]"
          >
            <Plus className="w-4 h-4" /> {t('products.createProduct')}
          </Link>
        </div>
      </div>

      {/* Stitch KPI overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative overflow-hidden rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6f7974]"><span>{t('products.kpiTotal')}</span><Package className="h-5 w-5 rounded-lg bg-[#eaedff] p-1 text-[#0d5c46]" /></div>
          <div className="my-2 flex items-baseline gap-2"><strong className="text-4xl font-bold text-[#131b2e]">{total}</strong><span className="text-xs text-[#6f7974]">{t('products.kpiUnique')}</span></div>
          <div className="rounded-md bg-[#f2f3ff]/70 px-2 py-1 text-xs text-[#6f7974]"><span className="font-semibold text-[#10b981]">{activeCount} {t('products.kpiActive')}</span><span className="mx-1">•</span>{draftCount} {t('products.kpiDrafts')}<span className="mx-1">•</span>{archivedCount} {t('products.kpiArchived')}</div>
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-[#0d5c46]/60" />
        </div>
        <div className="relative overflow-hidden rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6f7974]"><span>{t('products.kpiStockAlerts')}</span><CircleAlert className="h-5 w-5 rounded-lg bg-[#ffdad6] p-1 text-[#ba1a1a]" /></div>
          <div className="my-2 flex items-baseline gap-2"><strong className="text-4xl font-bold text-[#ba1a1a]">{lowStockProducts.length}</strong><span className="text-xs text-[#6f7974]">{t('products.kpiNeedRestock')}</span></div>
          <div className="flex items-center justify-between text-xs text-[#ba1a1a]"><span className="font-semibold">{outOfStockCount} {t('products.kpiOutOfStock')}</span><span className="text-[#0284c7]">{t('products.kpiRestockAction')}</span></div>
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-[#ba1a1a]/70" />
        </div>
        <div className="relative overflow-hidden rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6f7974]"><span>{t('products.kpiSupplierOffers')}</span><Tag className="h-5 w-5 rounded-lg bg-[#cce5ff] p-1 text-[#006398]" /></div>
          <div className="my-2 flex items-baseline gap-2"><strong className="text-4xl font-bold text-[#131b2e]">{supplierCount}</strong><span className="text-xs text-[#6f7974]">{t('products.kpiSynced')}</span></div>
          <div className="flex items-center gap-1 text-xs text-[#0d5c46]"><RefreshCw className="h-3.5 w-3.5" /> {t('products.kpiSyncActive')}</div>
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-[#0284c7]/60" />
        </div>
        <div className="relative overflow-hidden rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6f7974]"><span>{t('products.kpiMarginWarnings')}</span><ArrowDownUp className="h-5 w-5 rounded-lg bg-[#e1e7ff] p-1 text-[#006398]" /></div>
          <div className="my-2 flex items-baseline gap-2"><strong className="text-4xl font-bold text-[#131b2e]">{t('products.kpiUnavailable')}</strong><span className="text-xs text-[#6f7974]">{t('products.kpiMarginNote')}</span></div>
          <div className="text-xs text-[#6f7974]">{t('products.kpiMarginPending')}</div>
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-[#226a53]/50" />
        </div>
      </div>

      {(removalNotice || removalError) && (
        <div className="space-y-1" aria-live="polite">
          {removalNotice && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{removalNotice}</p>}
          {removalError && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{removalError}</p>}
        </div>
      )}

      {/* Stitch catalog operations card */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto border-b border-[#dae2fc]/60 px-4 pt-4">
          <div className="flex items-center gap-5 whitespace-nowrap text-sm font-semibold">
            {[
              ['all', t('products.tabAll'), total],
              ['published', t('products.tabActive'), activeCount],
              ['draft', t('products.tabDrafts'), draftCount],
              ['archived', t('products.tabArchived'), archivedCount]
            ].map(([value, label, count]) => (
              <button key={value} type="button" onClick={() => { setStatusFilter(value === 'all' ? 'all' : String(value)); setPage(0); }} className={`flex items-center gap-2 border-b-2 pb-3 ${statusFilter === value ? 'border-[#0d5c46] text-[#0d5c46]' : 'border-transparent text-[#6f7974] hover:text-[#131b2e]'}`}>
                <span>{label}</span><span className={`rounded-full px-2 py-0.5 text-[11px] ${statusFilter === value ? 'bg-[#0d5c46] text-white' : 'bg-[#eaedff] text-[#3f4944]'}`}>{count}</span>
              </button>
            ))}
            <button type="button" onClick={() => { setStatusFilter('all'); setPage(0); }} className="flex items-center gap-2 border-b-2 border-transparent pb-3 text-[#6f7974] hover:text-[#131b2e]"><span className="h-2 w-2 rounded-full bg-[#ba1a1a]" />{t('products.tabLowStock')}<span className="rounded-full bg-[#ffdad6] px-2 py-0.5 text-[11px] font-bold text-[#93000a]">{lowStockProducts.length}</span></button>
            <button type="button" className="flex items-center gap-2 border-b-2 border-transparent pb-3 text-[#6f7974] hover:text-[#131b2e]">{t('products.tabMargin')}<span className="rounded-full bg-[#eaedff] px-2 py-0.5 text-[11px]">{t('products.kpiUnavailable')}</span></button>
          </div>
        </div>
        {/* Filters Bar */}
        <div className="flex flex-col items-stretch justify-between gap-4 bg-[#faf8ff] p-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            {t('products.searchLabel')}
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('products.searchPlaceholder')}
              aria-label={t('products.searchAria')}
              data-testid="product-search"
              className="h-10 w-56 rounded-lg border-0 bg-[#f2f3ff] px-3 text-sm font-normal text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#0d5c46]"
            />
          </label>
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Filter className="w-3.5 h-3.5" /> {t('products.sourceLabel')}
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value as any);
                setPage(0);
              }}
              data-testid="product-filter-source"
              className="px-2 py-1 text-xs border border-slate-200 rounded bg-slate-50 font-normal focus:outline-none"
            >
              <option value="all">{t('products.allSources')}</option>
              <option value="seller_owned">{t('products.sellerOwned')}</option>
              <option value="supplier_backed">{t('products.supplierBacked')}</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            {t('products.statusLabel')}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              data-testid="product-filter-status"
              className="px-2 py-1 text-xs border border-slate-200 rounded bg-slate-50 font-normal focus:outline-none"
            >
              <option value="all">{t('products.allStatuses')}</option>
              <option value="draft">{t('statuses.draft')}</option>
              <option value="published">{t('products.statusPublished')}</option>
              <option value="unpublished">{t('products.statusUnpublished')}</option>
              <option value="archived">{t('common.archived')}</option>
            </select>
          </div>
          <div className="hidden lg:block">
            <select aria-label={t('products.channelFilterAria')} className="h-10 rounded-lg border-0 bg-[#f2f3ff] px-3 text-sm text-[#131b2e] focus:ring-2 focus:ring-[#0d5c46]"><option>{t('products.allChannels')}</option></select>
          </div>
          <button type="button" aria-label={t('products.columnsAria')} className="hidden h-10 w-10 items-center justify-center rounded-lg bg-[#f2f3ff] text-[#6f7974] hover:bg-[#eaedff] lg:inline-flex"><Columns3 className="h-5 w-5" /></button>
        </div>

        <div className="text-xs text-slate-500">
          {t('products.showingPrefix')} <span className="font-semibold text-slate-800">{products.length}</span>{' '}
          {t('products.showingSuffix').replace('{total}', String(total))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button type="button" onClick={selectedProductIds.size ? () => setSelectedProductIds(new Set()) : toggleVisibleSelection} className="rounded border border-slate-200 bg-white px-2 py-1.5 text-slate-700 hover:bg-slate-50">
            {selectedProductIds.size ? t('products.clearSelection') : t('products.selectVisible')}
          </button>
          {selectedProductIds.size > 0 && (
            <>
              <span className="text-slate-500">{t('products.selectedCount').replace('{count}', String(selectedProductIds.size))}</span>
              <button
                type="button"
                onClick={() => setPendingRemovalIds(Array.from(selectedProductIds))}
                className="inline-flex items-center gap-1 rounded bg-rose-600 px-2.5 py-1.5 font-semibold text-white hover:bg-rose-700"
              >
                <Trash2 className="h-3.5 w-3.5" /> {t('products.removeSelected')}
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label={t('products.viewGroupAria')}>
          <button
            type="button"
            aria-label={t('products.listAria')}
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ${view === 'list' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <List className="h-3.5 w-3.5" /> {t('products.listLabel')}
          </button>
          <button
            type="button"
            aria-label={t('products.gridAria')}
            aria-pressed={view === 'grid'}
            onClick={() => setView('grid')}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ${view === 'grid' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Grid2X2 className="h-3.5 w-3.5" /> {t('products.gridLabel')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#e1e7ff]/40 px-4 py-2 text-xs text-[#3f4944]">
        <div className="flex flex-wrap items-center gap-4"><label className="inline-flex items-center gap-2 font-semibold"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleSelection} className="h-4 w-4 accent-[#0d5c46]" />{t('products.bulkSelected').replace('{count}', String(selectedProductIds.size))}</label><span className="text-[#6f7974]">|</span><button type="button" className="text-[#0d5c46] hover:underline">{t('products.bulkPrice')}</button><button type="button" className="text-[#3f4944] hover:text-[#131b2e]">{t('products.bulkStatus')}</button><button type="button" className="text-[#ba1a1a] hover:underline">{t('products.bulkArchive')}</button></div>
        <div className="flex items-center gap-2 text-[#6f7974]"><span>{t('products.syncActive')}</span><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0d5c46]" /></div>
      </div>

      {/* Products */}
      <div className="overflow-hidden rounded-xl border border-[#e2dfeb] bg-white" aria-busy={refreshing}>
        {initialLoading ? (
          <div className="space-y-3 p-4" role="status" aria-label={t('products.loading')}>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 animate-pulse">
                <div className="h-12 w-12 rounded-lg bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/5 rounded bg-slate-200" />
                  <div className="h-2.5 w-3/5 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="p-8 text-center text-xs">
            <CircleAlert className="w-8 h-8 text-rose-300 mx-auto mb-2" />
            <p className="text-slate-600 mb-3">{loadError}</p>
            <button
              type="button"
              onClick={() => setRetryToken((token) => token + 1)}
              className="rounded-md bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-700"
            >
              {t('common.refresh')}
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            {t('products.emptyFilters')}
          </div>
        ) : view === 'grid' ? (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="product-grid-view">
            {products.map((product) => {
              const image = productImage(product, mediaByProductId);
              const available = product.inventory_summary?.total_available;
              return (
                <article key={product.id} data-testid="product-card" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="relative flex h-44 items-center justify-center bg-slate-100">
                    <label className="absolute end-3 top-3 z-10 rounded bg-white/95 p-1.5 shadow" aria-label={t('products.selectProduct').replace('{name}', product.name)}>
                      <input type="checkbox" checked={selectedProductIds.has(product.id)} onChange={() => toggleProductSelection(product.id)} disabled={!selectedProductIds.has(product.id) && selectedProductIds.size >= SELECTION_CAP} />
                    </label>
                    <ProductImagePreview
                      src={image}
                      alt={product.name}
                      noImageLabel={t('products.noImageAria')}
                      className="flex h-full w-full items-center justify-center object-cover"
                      iconClassName="h-12 w-12 text-slate-300"
                    />
                    <span className="absolute start-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase text-slate-700 shadow-sm">
                      {listingStatusLabel(product.listing_status || product.status, t)}
                    </span>
                  </div>
                  <div className="space-y-3 p-4">
                    <div>
                      <Link href={`/dashboard/stores/${store_id}/catalog/products/${product.id}`} className="text-sm font-bold text-slate-900 hover:text-indigo-700">
                        {product.name}
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                        <Tag className="h-3 w-3" />
                        {product.source === 'seller_owned' ? t('products.sellerOwned') : t('products.supplierBacked')}
                      </span>
                      {product.supplier_name && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{product.supplier_name}</span>}
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-[11px]">
                      <div>
                        <dt className="text-slate-400">{t('products.retailPrice')}</dt>
                        <dd className="font-semibold text-slate-800">{formatMoney(product.current_price, t('products.moneyNotSet'))}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">{t('products.available')}</dt>
                        <dd className="font-semibold text-slate-800">{available ?? '—'} {t('products.unitsSuffix')}</dd>
                      </div>
                    </dl>
                    <div className={`flex items-start gap-1.5 text-[11px] ${product.publish_readiness?.is_ready ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {product.publish_readiness?.is_ready ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                      <span className="line-clamp-2">{readinessLabel(product, t('products.readyToPublish'), t('products.readinessNotChecked'))}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="text-[10px] text-slate-400">{t('products.updatedPrefix')} {formatDate(product.updated_at, t('products.dateUnavailable'))}</span>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setPendingRemovalIds([product.id])} aria-label={t('products.removeProduct').replace('{name}', product.name)} className="text-rose-600 hover:text-rose-800">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <Link href={`/dashboard/stores/${store_id}/catalog/products/${product.id}`} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                          {t('products.editDetails')}
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto" data-testid="product-list-view">
            <table className="w-full text-start text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 font-semibold">
                <tr>
                  <th className="px-3 py-3">
                    <input type="checkbox" aria-label={allVisibleSelected ? t('products.clearSelection') : t('products.selectVisible')} checked={allVisibleSelected} onChange={toggleVisibleSelection} />
                  </th>
                  <th className="px-4 py-3">{t('products.colPreview')}</th>
                  <th className="px-4 py-3">{t('products.colProductName')}</th>
                  <th className="px-4 py-3 min-w-[120px]">{t('products.colSkuBarcode')}</th>
                  <th className="px-4 py-3">{t('products.colSource')}</th>
                  <th className="px-4 py-3">{t('products.colStatus')}</th>
                  <th className="px-4 py-3">{t('products.colInventory')}</th>
                  <th className="px-4 py-3 min-w-[170px]">{t('products.colCostMargin')}</th>
                  <th className="px-4 py-3">{t('products.colReadiness')}</th>
                  <th className="px-4 py-3 min-w-[110px]">{t('products.colChannels')}</th>
                  <th className="px-4 py-3">{t('products.colUpdated')}</th>
                  <th className="px-4 py-3 text-end">{t('products.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => {
                  const image = productImage(p, mediaByProductId);
                  const displayedStatus = p.listing_status || p.status;
                  return (
                  <tr key={p.id} data-testid="product-card" className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-3">
                      <input type="checkbox" aria-label={t('products.selectProduct').replace('{name}', p.name)} checked={selectedProductIds.has(p.id)} onChange={() => toggleProductSelection(p.id)} disabled={!selectedProductIds.has(p.id) && selectedProductIds.size >= SELECTION_CAP} />
                    </td>
                    <td className="px-4 py-2">
                      <ProductImagePreview
                        src={image}
                        alt=""
                        noImageLabel={t('products.noImageAria')}
                        className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg object-cover"
                        iconClassName="h-5 w-5 text-slate-300"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link href={`/dashboard/stores/${store_id}/catalog/products/${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                      {p.supplier_name && (
                        <div className="text-[10px] text-slate-400">{t('products.supplierPrefix')}{p.supplier_name}</div>
                      )}
                      <div className="mt-1 text-[10px] text-slate-400">{t('products.idPrefix')}{p.id.slice(0, 8)}…</div>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-slate-500"><span className="font-mono text-[#131b2e]">{p.supplier_code || '—'}</span><span className="block">{t('products.barcodeUnavailable')}</span></td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          p.source === 'seller_owned'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        <Tag className="w-3 h-3" />
                        {p.source === 'seller_owned' ? t('products.sellerOwned') : t('products.supplierBacked')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          displayedStatus === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : displayedStatus === 'draft'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {displayedStatus === 'active' && <CheckCircle2 className="w-3 h-3" />}
                        {displayedStatus === 'draft' && <CircleAlert className="w-3 h-3" />}
                        {displayedStatus === 'archived' && <Archive className="w-3 h-3" />}
                        {listingStatusLabel(displayedStatus, t)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{p.inventory_summary?.total_available ?? '—'} {t('products.availableCount')}</div>
                      <div className="text-[10px] text-slate-400">{formatMoney(p.current_price, t('products.priceNotSet'))}</div>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-slate-500"><div>{t('products.costUnavailable')}</div><div className="font-semibold text-slate-800">{formatMoney(p.current_price, t('products.priceNotSet'))}</div><div className="text-[#6f7974]">{t('products.marginUnavailable')}</div></td>
                    <td className="max-w-48 px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${p.publish_readiness?.is_ready ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {p.publish_readiness?.is_ready ? <CheckCircle2 className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />}
                        <span className="truncate">{readinessLabel(p, t('products.readyToPublish'), t('products.readinessNotChecked'))}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-slate-500">{t('products.channelDirect')}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[10px] text-slate-500">
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{formatDate(p.updated_at, t('products.dateUnavailable'))}</span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Link
                        href={`/dashboard/stores/${store_id}/catalog/products/${p.id}`}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        {t('products.editDetails')}
                      </Link>
                      <button type="button" onClick={() => setPendingRemovalIds([p.id])} aria-label={t('products.removeProduct').replace('{name}', p.name)} className="ms-3 inline-flex align-middle text-rose-600 hover:text-rose-800">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stitch pagination and operational footer */}
      {!initialLoading && !loadError && total > 0 && (
        <div className="flex flex-col items-center justify-between gap-4 border-t border-[#dae2fc] bg-white p-4 text-xs text-[#6f7974] sm:flex-row">
          <div className="flex items-center gap-4">
            <span>{t('products.rangeStatus').replace('{start}', String(rangeStart)).replace('{end}', String(rangeEnd)).replace('{total}', String(total))}</span>
            <span className="hidden h-4 w-px bg-[#dae2fc] sm:block" />
            <label className="flex items-center gap-2"><span>{t('products.rowsPerPage')}</span><select aria-label={t('products.rowsPerPage')} value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }} className="rounded border border-[#dae2fc] bg-white px-1.5 py-0.5 font-mono text-xs text-[#131b2e]"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page === 0}
              aria-label={t('products.prevPage')}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f2f3ff] text-[#6f7974] hover:bg-[#eaedff] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 3) }, (_, index) => index).map((pageIndex) => <button key={pageIndex} type="button" onClick={() => setPage(pageIndex)} className={`flex h-8 w-8 items-center justify-center rounded-lg font-mono text-xs ${page === pageIndex ? 'bg-[#0d5c46] font-bold text-white shadow-sm' : 'text-[#131b2e] hover:bg-[#eaedff]'}`}>{pageIndex + 1}</button>)}
            {totalPages > 4 && <><span className="px-1 font-mono">...</span><button type="button" onClick={() => setPage(totalPages - 1)} className={`flex h-8 w-8 items-center justify-center rounded-lg font-mono text-xs ${page === totalPages - 1 ? 'bg-[#0d5c46] font-bold text-white' : 'text-[#131b2e] hover:bg-[#eaedff]'}`}>{totalPages}</button></>}
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
              disabled={page >= totalPages - 1}
              aria-label={t('products.nextPage')}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f2f3ff] text-[#131b2e] hover:bg-[#eaedff] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      </div>

      <div className="flex flex-col items-center justify-between gap-4 rounded-xl bg-[#f2f3ff] p-4 shadow-sm md:flex-row">
        <div className="flex items-center gap-4"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#aaf1d4] text-[#0d5c46]"><CheckCircle2 className="h-6 w-6" /></div><div><strong className="block text-sm text-[#131b2e]">{t('products.syncBannerTitle')}</strong><span className="text-xs text-[#6f7974]">{t('products.syncBannerDescription')}</span></div></div>
        <button type="button" className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-[#0d5c46] shadow-sm hover:bg-[#eaedff]">{t('products.syncBannerAction')}</button>
      </div>

      <ConfirmModal
        isOpen={pendingRemovalIds.length > 0}
        title={t('products.confirmRemovalTitle')}
        description={t('products.confirmRemovalDescription').replace('{count}', String(pendingRemovalIds.length))}
        confirmLabel={removingProducts ? t('products.removingProducts') : t('products.confirmRemoveProducts')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        loading={removingProducts}
        onConfirm={confirmProductRemoval}
        onCancel={() => setPendingRemovalIds([])}
      />
    </div>
  );
}
