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
  Tag
} from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { Product } from '@/lib/api/types';
import { formatMoney } from '@/lib/money';

type ProductView = 'list' | 'grid';

function formatDate(value?: string) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleDateString();
}

function productImage(product: Product, mediaByProductId: Record<string, string>) {
  return product.primary_media_uri || mediaByProductId[product.id] || '';
}

function readinessLabel(product: Product) {
  if (product.publish_readiness?.is_ready) return 'Ready to publish';
  if (product.publish_readiness?.reasons?.[0]) return product.publish_readiness.reasons[0];
  return 'Readiness not checked';
}

export default function StoreProductsPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = use(params);
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [mediaByProductId, setMediaByProductId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('query') || '');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'seller_owned' | 'supplier_backed'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [view, setView] = useState<ProductView>('list');

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
            try {
              const detail = await sellerApi.getStoreProductDetail(store_id, product.id);
              const primary = detail.primary_media_uri || detail.media.find((media) => media.is_primary)?.uri || detail.media[0]?.uri;
              return primary ? ([product.id, primary] as const) : null;
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
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Store Products Catalog</h1>
          <p className="text-xs text-slate-500 mt-0.5">Unified catalog containing seller-owned products and supplier-backed items</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/stores/${store_id}/catalog/supplier-offers`}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
          >
            Import Supplier Offer
          </Link>
          <Link
            href={`/dashboard/stores/${store_id}/catalog/products/new`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            <Plus className="w-3.5 h-3.5" /> Create Product
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            Search:
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Name, slug, supplier..."
              aria-label="Filter products"
              className="w-48 px-2 py-1 text-xs border border-slate-200 rounded bg-slate-50 font-normal focus:outline-none"
            />
          </label>
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Filter className="w-3.5 h-3.5" /> Source:
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as any)}
              className="px-2 py-1 text-xs border border-slate-200 rounded bg-slate-50 font-normal focus:outline-none"
            >
              <option value="all">All Sources</option>
              <option value="seller_owned">Seller Owned</option>
              <option value="supplier_backed">Supplier Backed</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            Status:
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2 py-1 text-xs border border-slate-200 rounded bg-slate-50 font-normal focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-800">{filteredProducts.length}</span> of {products.length} products
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Product view">
          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ${view === 'list' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <List className="h-3.5 w-3.5" /> List
          </button>
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
            onClick={() => setView('grid')}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ${view === 'grid' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Grid2X2 className="h-3.5 w-3.5" /> Grid
          </button>
        </div>
      </div>

      {/* Products */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-xs animate-pulse">Loading products catalog...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            No products found matching filters.
          </div>
        ) : view === 'grid' ? (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => {
              const image = productImage(product, mediaByProductId);
              const available = product.inventory_summary?.total_available;
              return (
                <article key={product.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="relative flex h-44 items-center justify-center bg-slate-100">
                    {image ? (
                      <img src={image} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-12 w-12 text-slate-300" aria-label="No product image" />
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase text-slate-700 shadow-sm">
                      {product.status}
                    </span>
                  </div>
                  <div className="space-y-3 p-4">
                    <div>
                      <Link href={`/dashboard/stores/${store_id}/catalog/products/${product.id}`} className="text-sm font-bold text-slate-900 hover:text-indigo-700">
                        {product.name}
                      </Link>
                      <p className="mt-1 truncate font-mono text-[11px] text-slate-500">{product.slug}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                        <Tag className="h-3 w-3" />
                        {product.source === 'seller_owned' ? 'Seller Owned' : 'Supplier Backed'}
                      </span>
                      {product.supplier_name && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{product.supplier_name}</span>}
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-[11px]">
                      <div>
                        <dt className="text-slate-400">Retail price</dt>
                        <dd className="font-semibold text-slate-800">{formatMoney(product.current_price, 'Not set')}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">Available</dt>
                        <dd className="font-semibold text-slate-800">{available ?? '—'} units</dd>
                      </div>
                    </dl>
                    <div className={`flex items-start gap-1.5 text-[11px] ${product.publish_readiness?.is_ready ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {product.publish_readiness?.is_ready ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                      <span className="line-clamp-2">{readinessLabel(product)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="text-[10px] text-slate-400">Updated {formatDate(product.updated_at)}</span>
                      <Link href={`/dashboard/stores/${store_id}/catalog/products/${product.id}`} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                        Edit Details
                      </Link>
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
                  <th className="px-4 py-3">Preview</th>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Inventory</th>
                  <th className="px-4 py-3">Readiness</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const image = productImage(p, mediaByProductId);
                  return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2">
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                        {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-slate-300" aria-label="No product image" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link href={`/dashboard/stores/${store_id}/catalog/products/${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                      {p.supplier_name && (
                        <div className="text-[10px] text-slate-400">Supplier: {p.supplier_name}</div>
                      )}
                      <div className="mt-1 text-[10px] text-slate-400">ID: {p.id.slice(0, 8)}…</div>
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
                        {p.source === 'seller_owned' ? 'Seller Owned' : 'Supplier Backed'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">{p.slug}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          p.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.status === 'draft'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {p.status === 'active' && <CheckCircle2 className="w-3 h-3" />}
                        {p.status === 'draft' && <CircleAlert className="w-3 h-3" />}
                        {p.status === 'archived' && <Archive className="w-3 h-3" />}
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{p.inventory_summary?.total_available ?? '—'} available</div>
                      <div className="text-[10px] text-slate-400">{formatMoney(p.current_price, 'Price not set')}</div>
                    </td>
                    <td className="max-w-48 px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${p.publish_readiness?.is_ready ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {p.publish_readiness?.is_ready ? <CheckCircle2 className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />}
                        <span className="truncate">{readinessLabel(p)}</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[10px] text-slate-500">
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{formatDate(p.updated_at)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/stores/${store_id}/catalog/products/${p.id}`}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Edit Details
                      </Link>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
