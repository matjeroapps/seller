'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, AlertCircle, RefreshCw, DollarSign, Upload, Eye } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { SellerListing, StructuredPublishReadiness } from '@/lib/api/types';

export default function StoreListingDetailPage({
  params
}: {
  params: Promise<{ store_id: string; listing_id: string }> | { store_id: string; listing_id: string };
}) {
  const unwrappedParams =
    params && typeof (params as unknown as Promise<{ store_id: string; listing_id: string }>).then === 'function'
      ? use(params as Promise<{ store_id: string; listing_id: string }>)
      : (params as unknown as { store_id: string; listing_id: string }) || {};
  const { store_id, listing_id } = unwrappedParams;

  const [listing, setListing] = useState<SellerListing | null>(null);
  const [readiness, setReadiness] = useState<StructuredPublishReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [priceAmount, setPriceAmount] = useState<string>('');
  const [priceCurrency, setPriceCurrency] = useState<string>('SAR');
  const [updatingPrice, setUpdatingPrice] = useState(false);

  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    setActionError(null);
    Promise.all([
      sellerApi.getStoreListing(store_id, listing_id),
      sellerApi.getListingReadiness(store_id, listing_id).catch(() => null)
    ])
      .then(([listingRes, readinessRes]) => {
        setListing(listingRes);
        setReadiness(readinessRes);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [store_id, listing_id]);

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(priceAmount);
    if (isNaN(amount) || amount <= 0) return;
    setUpdatingPrice(true);
    setActionError(null);
    try {
      await sellerApi.updateListingPrice(store_id, listing_id, {
        currency: priceCurrency,
        amount
      });
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update retail price');
    } finally {
      setUpdatingPrice(false);
    }
  };

  const handlePublish = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const updated = await sellerApi.publishListing(store_id, listing_id);
      setListing(updated);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to publish listing');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnpublish = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const updated = await sellerApi.unpublishListing(store_id, listing_id);
      setListing(updated);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to unpublish listing');
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm('Archive this listing? Listing must be unpublished first.')) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const updated = await sellerApi.archiveListing(store_id, listing_id);
      setListing(updated);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to archive listing');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-500 animate-pulse">Loading listing merchandising details...</div>;
  }

  if (!listing) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="text-sm text-slate-500">Store listing not found.</div>
        <Link href={`/dashboard/stores/${store_id}/catalog/listings`} className="text-xs text-indigo-600 hover:underline">
          Back to Listings
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-3 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/stores/${store_id}/catalog/listings`}
            className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Listing Management</h1>
              <span
                className={`px-2 py-0.5 text-xs font-bold rounded uppercase ${
                  listing.status === 'published'
                    ? 'bg-emerald-100 text-emerald-800'
                    : listing.status === 'draft'
                    ? 'bg-amber-100 text-amber-800'
                    : listing.status === 'unpublished'
                    ? 'bg-slate-200 text-slate-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {listing.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Listing ID: <code className="bg-slate-100 px-1 py-0.5 rounded">{listing.id}</code> · Product ID:{' '}
              <code className="bg-slate-100 px-1 py-0.5 rounded">{listing.product_id}</code>
            </p>
          </div>
        </div>

        {/* Lifecycle Actions */}
        <div className="flex items-center gap-2">
          {listing.status !== 'published' && (
            <button
              type="button"
              disabled={Boolean(actionLoading || (readiness && !readiness.is_ready))}
              onClick={handlePublish}
              className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50"
            >
              Publish Listing
            </button>
          )}

          {listing.status === 'published' && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleUnpublish}
              className="px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-100 border border-amber-300 rounded-md hover:bg-amber-200 disabled:opacity-50"
            >
              Unpublish Listing
            </button>
          )}

          {listing.status !== 'published' && listing.status !== 'archived' && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleArchive}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50"
            >
              Archive Listing
            </button>
          )}
        </div>
      </div>

      {/* Structured Readiness Inspection Panel */}
      <div
        className={`p-6 border rounded-lg shadow-sm space-y-3 ${
          readiness?.is_ready ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {readiness?.is_ready ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-600" />
            )}
            <h2 className="text-sm font-bold text-slate-900">
              Publish Readiness: {readiness?.is_ready ? 'READY FOR PUBLICATION' : 'ACTION REQUIRED'}
            </h2>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Re-check Readiness
          </button>
        </div>

        {readiness && !readiness.is_ready && (
          <div className="space-y-1.5 pt-2 border-t border-amber-200">
            <div className="text-xs font-semibold text-amber-900">Blocking Reasons:</div>
            <ul className="space-y-1">
              {readiness.reasons.map((r, idx) => (
                <li key={idx} className="flex items-center gap-2 text-xs text-amber-800">
                  <span className="font-mono text-[10px] bg-amber-200/60 px-1.5 py-0.5 rounded uppercase">{r.code}</span>
                  <span>{r.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Retail Price Configuration Card */}
      <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">Retail Price Merchandising</h2>
        <form onSubmit={handleUpdatePrice} className="flex items-center gap-3 max-w-md">
          <div className="w-24">
            <label className="block text-[11px] text-slate-500 mb-1">Currency</label>
            <select
              value={priceCurrency}
              onChange={(e) => setPriceCurrency(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none"
            >
              <option value="SAR">SAR</option>
              <option value="USD">USD</option>
              <option value="AED">AED</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[11px] text-slate-500 mb-1">Retail Price Amount</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="e.g. 150.00"
              value={priceAmount}
              onChange={(e) => setPriceAmount(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none"
            />
          </div>
          <div className="self-end">
            <button
              type="submit"
              disabled={updatingPrice}
              className="px-3 py-1.5 text-xs font-medium bg-slate-800 text-white rounded hover:bg-slate-900 disabled:opacity-50"
            >
              Update Price
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
