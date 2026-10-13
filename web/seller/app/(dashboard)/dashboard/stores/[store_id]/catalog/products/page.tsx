'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Filter,
  Grid2X2,
  ImageIcon,
  List,
  Package,
  Plus,
  Tag,
  Trash2
} from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { Product } from '@/lib/api/types';
import { useTranslation } from '@/lib/i18n/locale-context';
import { formatMoney } from '@/lib/money';
import { ConfirmModal } from '@/components/seller/ConfirmModal';

type ProductView = 'list' | 'grid';

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
    draft: t('common.draft'),
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
      <div className={`${className} bg-slate-100`} role="img" aria-label={noImageLabel}>
        <ImageIcon className={iconClassName} aria-hidden="true" />
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}

export default function StoreProductsPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = use(params);
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const [products, setProducts] = useState<Product[]>([]);
  const [mediaByProductId, setMediaByProductId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('query') || '');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'seller_owned' | 'supplier_backed'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [view, setView] = useState<ProductView>('list');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [pendingRemovalIds, setPendingRemovalIds] = useState<string[]>([]);
  const [removingProducts, setRemovingProducts] = useState(false);
  const [removalNotice, setRemovalNotice] = useState<string | null>(null);
  const [removalError, setRemovalError] = useState<string | null>(null);

  useEffect(() => {
    setSearchQuery(searchParams.get('query') || '');
  }, [searchParams]);

  useEffect(() => {
    let isMounted = true;
    sellerApi
      .listStoreProducts(store_id)
      .then(async (res) => {
        if (!isMounted) return;
        const items = res.items || [];
        setProducts(items);
        setLoading(false);

        const mediaEntries = await Promise.all(
          items.map(async (product) => {
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
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [store_id]);

  const filteredProducts = products.filter((p) => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (
      normalizedQuery &&
      ![p.name, p.slug, p.supplier_name, p.supplier_code].some((value) => value?.toLowerCase().includes(normalizedQuery))
    ) {
      return false;
    }
    if (sourceFilter !== 'all' && p.source !== sourceFilter) return false;
    if (statusFilter !== 'all' && (p.listing_status || p.status) !== statusFilter) return false;
    return true;
  });

  const selectedVisibleCount = filteredProducts.filter((product) => selectedProductIds.has(product.id)).length;
  const allVisibleSelected = filteredProducts.length > 0 && selectedVisibleCount === filteredProducts.length;

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else if (next.size < 100) next.add(productId);
      return next;
    });
  };

  const toggleVisibleSelection = () => {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) filteredProducts.forEach((product) => next.delete(product.id));
      else {
        for (const product of filteredProducts) {
          if (next.size >= 100) break;
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
      const refreshed = await sellerApi.listStoreProducts(store_id);
      setProducts(refreshed.items || []);
    } catch (error: any) {
      setRemovalError(error.message || t('products.errorRemoveProducts'));
    } finally {
      setRemovingProducts(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('products.catalogTitle')}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{t('products.catalogSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/stores/${store_id}/catalog/supplier-offers`}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
          >
            {t('products.importSupplierOffer')}
          </Link>
          <Link
            href={`/dashboard/stores/${store_id}/catalog/products/new`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            <Plus className="w-3.5 h-3.5" /> {t('products.createProduct')}
          </Link>
        </div>
      </div>

      {(removalNotice || removalError) && (
        <div className="space-y-1" aria-live="polite">
          {removalNotice && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{removalNotice}</p>}
          {removalError && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{removalError}</p>}
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            {t('products.searchLabel')}
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('products.searchPlaceholder')}
              aria-label={t('products.searchAria')}
              className="w-48 px-2 py-1 text-xs border border-slate-200 rounded bg-slate-50 font-normal focus:outline-none"
            />
          </label>
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Filter className="w-3.5 h-3.5" /> {t('products.sourceLabel')}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as any)}
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
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2 py-1 text-xs border border-slate-200 rounded bg-slate-50 font-normal focus:outline-none"
            >
              <option value="all">{t('products.allStatuses')}</option>
              <option value="draft">{t('statuses.draft')}</option>
              <option value="published">{t('products.statusPublished')}</option>
              <option value="unpublished">{t('products.statusUnpublished')}</option>
              <option value="archived">{t('common.archived')}</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          {t('products.showingPrefix')} <span className="font-semibold text-slate-800">{filteredProducts.length}</span>{' '}
          {t('products.showingSuffix').replace('{total}', String(products.length))}
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

      {/* Products */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-xs animate-pulse">{t('products.loading')}</div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            {t('products.emptyFilters')}
          </div>
        ) : view === 'grid' ? (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => {
              const image = productImage(product, mediaByProductId);
              const available = product.inventory_summary?.total_available;
              return (
                <article key={product.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="relative flex h-44 items-center justify-center bg-slate-100">
                    <label className="absolute right-3 top-3 z-10 rounded bg-white/95 p-1.5 shadow" aria-label={t('products.selectProduct').replace('{name}', product.name)}>
                      <input type="checkbox" checked={selectedProductIds.has(product.id)} onChange={() => toggleProductSelection(product.id)} disabled={!selectedProductIds.has(product.id) && selectedProductIds.size >= 100} />
                    </label>
                    <ProductImagePreview
                      src={image}
                      alt={product.name}
                      noImageLabel={t('products.noImageAria')}
                      className="flex h-full w-full items-center justify-center object-cover"
                      iconClassName="h-12 w-12 text-slate-300"
                    />
                    <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase text-slate-700 shadow-sm">
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 font-semibold">
                <tr>
                  <th className="px-3 py-3">
                    <input type="checkbox" aria-label={allVisibleSelected ? t('products.clearSelection') : t('products.selectVisible')} checked={allVisibleSelected} onChange={toggleVisibleSelection} />
                  </th>
                  <th className="px-4 py-3">{t('products.colPreview')}</th>
                  <th className="px-4 py-3">{t('products.colProductName')}</th>
                  <th className="px-4 py-3">{t('products.colSource')}</th>
                  <th className="px-4 py-3">{t('products.colStatus')}</th>
                  <th className="px-4 py-3">{t('products.colInventory')}</th>
                  <th className="px-4 py-3">{t('products.colReadiness')}</th>
                  <th className="px-4 py-3">{t('products.colUpdated')}</th>
                  <th className="px-4 py-3 text-right">{t('products.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const image = productImage(p, mediaByProductId);
                  const displayedStatus = p.listing_status || p.status;
                  return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-3">
                      <input type="checkbox" aria-label={t('products.selectProduct').replace('{name}', p.name)} checked={selectedProductIds.has(p.id)} onChange={() => toggleProductSelection(p.id)} disabled={!selectedProductIds.has(p.id) && selectedProductIds.size >= 100} />
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
                    <td className="max-w-48 px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${p.publish_readiness?.is_ready ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {p.publish_readiness?.is_ready ? <CheckCircle2 className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />}
                        <span className="truncate">{readinessLabel(p, t('products.readyToPublish'), t('products.readinessNotChecked'))}</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[10px] text-slate-500">
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{formatDate(p.updated_at, t('products.dateUnavailable'))}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/stores/${store_id}/catalog/products/${p.id}`}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        {t('products.editDetails')}
                      </Link>
                      <button type="button" onClick={() => setPendingRemovalIds([p.id])} aria-label={t('products.removeProduct').replace('{name}', p.name)} className="ml-3 inline-flex align-middle text-rose-600 hover:text-rose-800">
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
