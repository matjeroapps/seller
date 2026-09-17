'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Package, Plus, Filter, Tag, CheckCircle2, Archive, AlertCircle } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { Product } from '@/lib/api/types';

export default function StoreProductsPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = use(params);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'seller_owned' | 'supplier_backed'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    let isMounted = true;
    sellerApi
      .listStoreProducts(store_id)
      .then((res) => {
        if (!isMounted) return;
        setProducts(res.items || []);
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [store_id]);

  const filteredProducts = products.filter((p) => {
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
      </div>

      {/* Products Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-xs animate-pulse">Loading products catalog...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            No products found matching filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 font-semibold">
                <tr>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link href={`/dashboard/stores/${store_id}/catalog/products/${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                      {p.supplier_name && (
                        <div className="text-[10px] text-slate-400">Supplier: {p.supplier_name}</div>
                      )}
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
                        {p.status === 'draft' && <AlertCircle className="w-3 h-3" />}
                        {p.status === 'archived' && <Archive className="w-3 h-3" />}
                        {p.status}
                      </span>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
