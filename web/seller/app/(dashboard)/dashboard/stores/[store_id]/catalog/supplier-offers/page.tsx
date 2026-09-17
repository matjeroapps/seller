'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Truck, Search, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { SupplierCatalogItem } from '@/lib/api/types';

export default function StoreSupplierOffersPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = use(params);

  const [offers, setOffers] = useState<SupplierCatalogItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [importingOfferId, setImportingOfferId] = useState<string | null>(null);

  const loadOffers = (searchQuery?: string) => {
    setLoading(true);
    sellerApi
      .listStoreSupplierOffers(store_id, searchQuery)
      .then((res) => {
        setOffers(res.items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadOffers();
  }, [store_id]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadOffers(query);
  };

  const handleImport = async (offerId: string) => {
    setImportingOfferId(offerId);
    try {
      const listing = await sellerApi.importSupplierOffer(store_id, offerId);
      alert('Supplier offer imported successfully as a store listing!');
    } catch (err: any) {
      alert(err.message || 'Failed to import supplier offer');
    } finally {
      setImportingOfferId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Supplier Offers Catalog</h1>
          <p className="text-xs text-slate-500 mt-0.5">Discover active supplier offers eligible for store import</p>
        </div>
        <Link
          href={`/dashboard/stores/${store_id}/catalog/listings`}
          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 self-start"
        >
          View Store Listings
        </Link>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search supplier offers by product name, supplier, or category..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button type="submit" className="px-3 py-1.5 text-xs font-medium bg-slate-800 text-white rounded-md hover:bg-slate-900">
          Search
        </button>
      </form>

      {/* Offers Grid */}
      {loading ? (
        <div className="p-6 text-sm text-slate-500 animate-pulse">Loading eligible supplier offers...</div>
      ) : offers.length === 0 ? (
        <div className="p-8 bg-white border border-slate-200 rounded-lg text-center text-xs text-slate-500">
          <Truck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          No eligible supplier offers available for this store market.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers.map((offer) => (
            <div key={offer.offer_id} className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{offer.product_name}</h3>
                  <div className="text-[11px] text-slate-500">Supplier: {offer.supplier_name}</div>
                </div>
                <span className="bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200">
                  {offer.market_code}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-100">
                <div>
                  <span className="text-slate-400">Offer Price:</span>
                  <div className="font-semibold text-slate-800">
                    {offer.price ? `${offer.price.currency} ${offer.price.amount}` : 'N/A'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Availability:</span>
                  <div className="font-semibold text-slate-800">
                    {offer.is_available ? `${offer.available_qty ?? 'In Stock'}` : 'Unavailable'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={importingOfferId === offer.offer_id || !offer.is_available}
                onClick={() => handleImport(offer.offer_id)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                {importingOfferId === offer.offer_id ? 'Importing...' : 'Import to Store Catalog'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
