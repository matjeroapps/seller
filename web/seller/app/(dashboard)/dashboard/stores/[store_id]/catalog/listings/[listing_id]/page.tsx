'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, AlertCircle, RefreshCw, DollarSign, Upload, Eye, TrendingUp, Percent, ShieldAlert } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { SellerListing, SellerListingLifecycle, StructuredPublishReadiness } from '@/lib/api/types';

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
  const [lifecycle, setLifecycle] = useState<SellerListingLifecycle | null>(null);
  const [readiness, setReadiness] = useState<StructuredPublishReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [priceAmount, setPriceAmount] = useState<string>('');
  const [priceCurrency, setPriceCurrency] = useState<string>('SAR');
  const [markupPercent, setMarkupPercent] = useState<string>('20');
  const [shippingSubsidy, setShippingSubsidy] = useState<'buyer_paid' | 'seller_free'>('buyer_paid');
  const [estimatedShipping, setEstimatedShipping] = useState<string>('15');
  const [updatingPrice, setUpdatingPrice] = useState(false);

  const loadData = () => {
    setLoading(true);
    setActionError(null);
    Promise.all([
      sellerApi.getStoreListing(store_id, listing_id),
      sellerApi.getStoreListingLifecycle(store_id, listing_id).catch(() => null),
      sellerApi.getListingReadiness(store_id, listing_id).catch(() => null)
    ])
      .then(([listingRes, lifecycleRes, readinessRes]) => {
        setListing(listingRes);
        setLifecycle(lifecycleRes);
        setReadiness(readinessRes);

        // Pre-fill retail price if available
        if (lifecycleRes?.current_retail_price?.amount) {
          setPriceAmount((lifecycleRes.current_retail_price.amount / 100).toFixed(2));
          setPriceCurrency(lifecycleRes.current_retail_price.currency || 'SAR');
        }

        // Calculate initial markup % if wholesale price is available
        const wholesale = lifecycleRes?.upstream_wholesale_price?.amount;
        const retail = lifecycleRes?.current_retail_price?.amount;
        if (wholesale && retail && wholesale > 0) {
          const calcMarkup = (((retail - wholesale) / wholesale) * 100).toFixed(1);
          setMarkupPercent(calcMarkup);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [store_id, listing_id]);

  const handleApplyMarkup = (pct: number) => {
    setMarkupPercent(pct.toString());
    const wholesaleCents = lifecycle?.upstream_wholesale_price?.amount;
    if (wholesaleCents && wholesaleCents > 0) {
      const wholesale = wholesaleCents / 100;
      const newRetail = wholesale * (1 + pct / 100);
      setPriceAmount(newRetail.toFixed(2));
    }
  };

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

  // Calculated economics
  const wholesaleCents = lifecycle?.upstream_wholesale_price?.amount;
  const wholesaleVal = wholesaleCents ? wholesaleCents / 100 : null;
  const currentRetailVal = parseFloat(priceAmount) || 0;
  const shippingVal = shippingSubsidy === 'seller_free' ? parseFloat(estimatedShipping) || 0 : 0;
  const grossMarginVal = wholesaleVal ? currentRetailVal - wholesaleVal : 0;
  const netMarginVal = grossMarginVal - shippingVal;
  const netMarginPercent = currentRetailVal > 0 ? (netMarginVal / currentRetailVal) * 100 : 0;
  const hasUnsafeMargin = (wholesaleVal !== null && netMarginVal < 0) || Boolean(lifecycle?.has_margin_warning);

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
              disabled={Boolean(actionLoading || (readiness && !readiness.is_ready) || hasUnsafeMargin)}
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

      {/* Margin Safety Warning Banner */}
      {hasUnsafeMargin && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-lg flex items-start gap-3 text-xs text-rose-900">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold uppercase tracking-wider text-rose-800">Unsafe Merchant Margin Warning</div>
            <div>
              {netMarginVal < 0
                ? `Seller-subsidized shipping or low retail price results in negative net profit (${netMarginVal.toFixed(2)} ${priceCurrency}).`
                : 'Upstream wholesale cost exceeds retail price. Increase your markup % to resolve this issue.'}
            </div>
            <div className="text-[11px] text-rose-700">
              Publishing is restricted while net margin is negative to protect merchant profitability.
            </div>
          </div>
        </div>
      )}

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

      {/* Catalog Economics & Merchandising Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Price & Markup Controls (2 cols) */}
        <div className="md:col-span-2 space-y-6">
          {/* Percentage Markup & Retail Pricing Card */}
          <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                Percentage Markup & Retail Merchandising
              </h2>
            </div>

            {/* Quick Markup Presets */}
            {wholesaleVal !== null && (
              <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-md text-xs">
                <div className="text-slate-600 font-medium flex items-center justify-between">
                  <span>Quick Markup Presets (Over Wholesale {wholesaleVal.toFixed(2)} {priceCurrency}):</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {[10, 15, 20, 30, 50].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleApplyMarkup(pct)}
                      className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100"
                    >
                      +{pct}% Markup ({ (wholesaleVal * (1 + pct / 100)).toFixed(2) } {priceCurrency})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Price Form */}
            <form onSubmit={handleUpdatePrice} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Currency</label>
                  <select
                    value={priceCurrency}
                    onChange={(e) => setPriceCurrency(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="SAR">SAR</option>
                    <option value="USD">USD</option>
                    <option value="AED">AED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Target Markup %</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 20"
                      value={markupPercent}
                      onChange={(e) => {
                        setMarkupPercent(e.target.value);
                        const pct = parseFloat(e.target.value);
                        if (!isNaN(pct) && wholesaleVal !== null) {
                          setPriceAmount((wholesaleVal * (1 + pct / 100)).toFixed(2));
                        }
                      }}
                      className="w-full pr-7 pl-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <Percent className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Retail Price Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 150.00"
                    value={priceAmount}
                    onChange={(e) => setPriceAmount(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                  />
                </div>
              </div>

              {/* Shipping Subsidy Policy */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2 text-xs">
                <div className="font-semibold text-slate-800">Shipping Subsidy Policy</div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="shipping_policy"
                      value="buyer_paid"
                      checked={shippingSubsidy === 'buyer_paid'}
                      onChange={() => setShippingSubsidy('buyer_paid')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    Buyer pays shipping
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="shipping_policy"
                      value="seller_free"
                      checked={shippingSubsidy === 'seller_free'}
                      onChange={() => setShippingSubsidy('seller_free')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    Seller-subsidized free shipping
                  </label>
                </div>

                {shippingSubsidy === 'seller_free' && (
                  <div className="pt-2 flex items-center gap-2">
                    <span className="text-slate-500">Est. Shipping Cost per Order:</span>
                    <input
                      type="number"
                      step="0.5"
                      value={estimatedShipping}
                      onChange={(e) => setEstimatedShipping(e.target.value)}
                      className="w-24 px-2 py-1 text-xs border border-slate-300 rounded"
                    />
                    <span className="text-slate-500">{priceCurrency}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={updatingPrice}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-800 rounded-md hover:bg-slate-900 disabled:opacity-50"
                >
                  Save & Update Retail Price
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Economics Summary Card (1 col) */}
        <div className="space-y-6">
          <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm space-y-3 text-xs">
            <h2 className="font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
              Margin & Economics Breakdown
            </h2>

            <div className="space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>Upstream Wholesale Cost</span>
                <span className="font-mono font-medium">
                  {wholesaleVal !== null ? `${wholesaleVal.toFixed(2)} ${priceCurrency}` : 'N/A'}
                </span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Current Retail Price</span>
                <span className="font-mono font-medium">{currentRetailVal.toFixed(2)} {priceCurrency}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Gross Margin ($)</span>
                <span className={`font-mono font-semibold ${grossMarginVal >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {grossMarginVal.toFixed(2)} {priceCurrency}
                </span>
              </div>

              {shippingSubsidy === 'seller_free' && (
                <div className="flex justify-between text-slate-600">
                  <span>Shipping Subsidy Deduction</span>
                  <span className="font-mono text-rose-600">-{shippingVal.toFixed(2)} {priceCurrency}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                <span>Net Profit Margin ($)</span>
                <span className={`font-mono ${netMarginVal >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {netMarginVal.toFixed(2)} {priceCurrency}
                </span>
              </div>

              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-500">Net Profit Margin (%)</span>
                <span className={`font-mono font-bold ${netMarginPercent >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {netMarginPercent.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
