'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Package, Truck, Boxes, Image as ImageIcon, Store as StoreIcon, Activity } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { Store, Product, SellerListing } from '@/lib/api/types';

export default function StoreOverviewPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = use(params);

  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [listings, setListings] = useState<SellerListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      sellerApi.getStores(),
      sellerApi.listStoreProducts(store_id).catch(() => ({ items: [] })),
      sellerApi.listStoreListings(store_id).catch(() => ({ items: [] }))
    ])
      .then(([storeRes, prodRes, listRes]) => {
        if (!isMounted) return;
        setStores(storeRes.items || []);
        setProducts(prodRes.items || []);
        setListings(listRes.items || []);
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [store_id]);

  const currentStore = stores.find((s) => s.id === store_id);

  const handleStatusChange = async (newStatus: string) => {
    if (!currentStore) return;
    setUpdatingStatus(true);
    try {
      const updated = await sellerApi.updateStoreStatus(store_id, newStatus);
      setStores((prev) => prev.map((s) => (s.id === store_id ? updated : s)));
    } catch (err: any) {
      alert(err.message || 'Failed to update store status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-500 animate-pulse">Loading store dashboard...</div>;
  }

  const publishedCount = listings.filter((l) => l.status === 'published').length;
  const draftListingsCount = listings.filter((l) => l.status === 'draft').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 bg-white border border-slate-200 rounded-lg shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{currentStore?.name || 'Store Dashboard'}</h1>
            {currentStore && (
              <span
                className={`px-2 py-0.5 text-xs font-semibold rounded uppercase ${
                  currentStore.status === 'active'
                    ? 'bg-emerald-100 text-emerald-800'
                    : currentStore.status === 'draft'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {currentStore.status}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Store ID: <code className="bg-slate-100 px-1 py-0.5 rounded">{store_id}</code> · Code:{' '}
            <code className="bg-slate-100 px-1 py-0.5 rounded">{currentStore?.code}</code> · Market:{' '}
            <code className="bg-slate-100 px-1 py-0.5 rounded">{currentStore?.market_code}</code>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentStore?.status === 'draft' && (
            <button
              type="button"
              disabled={updatingStatus}
              onClick={() => handleStatusChange('active')}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
            >
              Activate Store
            </button>
          )}
          {currentStore?.status === 'active' && (
            <button
              type="button"
              disabled={updatingStatus}
              onClick={() => handleStatusChange('inactive')}
              className="px-3 py-1.5 text-xs font-medium bg-slate-600 text-white rounded hover:bg-slate-700 disabled:opacity-50"
            >
              Deactivate Store
            </button>
          )}
          {currentStore?.status === 'inactive' && (
            <button
              type="button"
              disabled={updatingStatus}
              onClick={() => handleStatusChange('active')}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
            >
              Re-activate Store
            </button>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href={`/dashboard/stores/${store_id}/catalog/products`}
          className="p-4 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Products</span>
            <Package className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{products.length}</div>
          <div className="text-xs text-slate-500 mt-1">Total store products</div>
        </Link>

        <Link
          href={`/dashboard/stores/${store_id}/catalog/listings`}
          className="p-4 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Published</span>
            <Activity className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{publishedCount}</div>
          <div className="text-xs text-slate-500 mt-1">{draftListingsCount} in draft</div>
        </Link>

        <Link
          href={`/dashboard/stores/${store_id}/catalog/supplier-offers`}
          className="p-4 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Supplier Offers</span>
            <Truck className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">Browse</div>
          <div className="text-xs text-slate-500 mt-1">Import supplier catalog</div>
        </Link>

        <Link
          href={`/dashboard/stores/${store_id}/media`}
          className="p-4 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Media Library</span>
            <ImageIcon className="w-5 h-5 text-sky-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">Manage</div>
          <div className="text-xs text-slate-500 mt-1">Presigned S3 upload & assets</div>
        </Link>
      </div>

      {/* Quick Navigation Cards */}
      <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Catalog Operations</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link
            href={`/dashboard/stores/${store_id}/catalog/products/new`}
            className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
          >
            <Package className="w-5 h-5 text-indigo-600" />
            <div>
              <div className="text-xs font-semibold text-slate-900">New Product</div>
              <div className="text-[11px] text-slate-500">Create seller-owned draft product</div>
            </div>
          </Link>

          <Link
            href={`/dashboard/stores/${store_id}/catalog/supplier-offers`}
            className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
          >
            <Truck className="w-5 h-5 text-amber-600" />
            <div>
              <div className="text-xs font-semibold text-slate-900">Import Offers</div>
              <div className="text-[11px] text-slate-500">Idempotent supplier offer import</div>
            </div>
          </Link>

          <Link
            href={`/dashboard/stores/${store_id}/inventory`}
            className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
          >
            <Boxes className="w-5 h-5 text-emerald-600" />
            <div>
              <div className="text-xs font-semibold text-slate-900">Inventory</div>
              <div className="text-[11px] text-slate-500">Adjust on-hand snapshot stock</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
