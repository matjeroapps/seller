'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Boxes, Filter, CheckCircle2, AlertCircle, Archive, ArrowUpRight } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { SellerListing } from '@/lib/api/types';

export default function StoreListingsPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = use(params);

  const [listings, setListings] = useState<SellerListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    let isMounted = true;
    sellerApi
      .listStoreListings(store_id)
      .then((res) => {
        if (!isMounted) return;
        setListings(res.items || []);
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [store_id]);

  const filteredListings = listings.filter((l) => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Store Listings</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage store retail presentation, readiness, and publication state</p>
        </div>
        <Link
          href={`/dashboard/stores/${store_id}/catalog/products`}
          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 self-start"
        >
          View Products Catalog
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <Filter className="w-3.5 h-3.5" /> Status:
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1 text-xs border border-slate-200 rounded bg-slate-50 font-normal focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-800">{filteredListings.length}</span> of {listings.length} listings
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 animate-pulse">Loading store listings...</div>
        ) : filteredListings.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            No store listings found matching status filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 font-semibold">
                <tr>
                  <th className="px-4 py-3">Listing ID</th>
                  <th className="px-4 py-3">Product ID</th>
                  <th className="px-4 py-3">Source Type</th>
                  <th className="px-4 py-3">Market</th>
                  <th className="px-4 py-3">Publish Status</th>
                  <th className="px-4 py-3">Availability</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredListings.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-slate-900">{l.id}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{l.product_id}</td>
                    <td className="px-4 py-3">
                      {l.supplier_offer_id ? (
                        <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded text-[10px] font-medium border border-amber-200">
                          Supplier Backed
                        </span>
                      ) : (
                        <span className="bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded text-[10px] font-medium border border-indigo-200">
                          Seller Owned
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{l.market_code}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          l.status === 'published'
                            ? 'bg-emerald-100 text-emerald-800'
                            : l.status === 'draft'
                            ? 'bg-amber-100 text-amber-800'
                            : l.status === 'unpublished'
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {l.status === 'published' && <CheckCircle2 className="w-3 h-3" />}
                        {l.status === 'draft' && <AlertCircle className="w-3 h-3" />}
                        {l.status === 'archived' && <Archive className="w-3 h-3" />}
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {l.status === 'published' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active Supply
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-normal">
                          {l.status === 'draft' ? 'Draft (Unpublished)' : 'Inactive'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/stores/${store_id}/catalog/listings/${l.id}`}
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Manage <ArrowUpRight className="w-3 h-3" />
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
