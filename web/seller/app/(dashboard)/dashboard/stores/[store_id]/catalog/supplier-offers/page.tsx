'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Truck, Search, Download, CheckCircle2, AlertCircle, Percent, ShieldAlert, DollarSign } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { SupplierCatalogItem } from '@/lib/api/types';
import { formatMoney, minorAmount, minorToMajor } from '@/lib/money';

export default function StoreSupplierOffersPage({
  params
}: {
  params: Promise<{ store_id: string }> | { store_id: string };
}) {
  const unwrappedParams =
    params && typeof (params as unknown as Promise<{ store_id: string }>).then === 'function'
      ? use(params as Promise<{ store_id: string }>)
      : (params as unknown as { store_id: string }) || {};
  const { store_id } = unwrappedParams;

  const [offers, setOffers] = useState<SupplierCatalogItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [importingOfferId, setImportingOfferId] = useState<string | null>(null);
  const [importedOffers, setImportedOffers] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string; listingId?: string } | null>(null);

  // Import Configuration Modal state
  const [selectedOffer, setSelectedOffer] = useState<SupplierCatalogItem | null>(null);
  const [markupPercent, setMarkupPercent] = useState<string>('20');
  const [shippingSubsidy, setShippingSubsidy] = useState<'buyer_paid' | 'seller_free'>('buyer_paid');
  const [estimatedShipping, setEstimatedShipping] = useState<string>('15');

  const loadOffers = (searchQuery?: string) => {
    setLoading(true);
    sellerApi
      .listStoreSupplierOffers(store_id, searchQuery)
      .then((res) => {
        setOffers(res.items || []);
        setLoading(false);
      })
      .catch((err) => {
        setNotification({ type: 'error', message: err.message || 'Failed to load supplier offers' });
        setLoading(false);
      });
  };

  useEffect(() => {
    loadOffers();
  }, [store_id]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadOffers(query);
  };

  const handleOpenImportModal = (offer: SupplierCatalogItem) => {
    setSelectedOffer(offer);
    setMarkupPercent('20');
    setShippingSubsidy('buyer_paid');
    setEstimatedShipping('15');
  };

  const handleConfirmImport = async () => {
    if (!selectedOffer) return;
    const offerId = selectedOffer.offer_id;
    setImportingOfferId(offerId);
    setNotification(null);
    try {
      const listing = await sellerApi.importSupplierOffer(store_id, offerId);

      // Persist the markup as the listing retail price (minor units).
      // Shipping policy is NOT persisted: no API stores it, so it is preview-only.
      const wholesaleMinor = minorAmount(selectedOffer.price) ?? 0;
      const cur = selectedOffer.price?.currency || 'SAR';
      const pct = parseFloat(markupPercent) || 0;
      let priceError: string | null = null;
      if (wholesaleMinor > 0 && pct > 0) {
        const retailMinor = Math.round(wholesaleMinor * (1 + pct / 100));
        try {
          await sellerApi.updateListingPrice(store_id, listing.id, { currency: cur, amount_minor: retailMinor });
        } catch (priceErr: any) {
          priceError = priceErr?.message || 'unknown error';
        }
      }

      setImportedOffers((prev) => ({ ...prev, [offerId]: listing.id }));
      setSelectedOffer(null);
      setNotification(
        priceError
          ? {
              type: 'error',
              message: `Offer imported, but the retail price was NOT saved (${priceError}). Set it on the listing page before publishing.`,
              listingId: listing.id,
            }
          : {
              type: 'success',
              message:
                wholesaleMinor > 0 && pct > 0
                  ? `Offer imported and retail price saved (${pct}% markup). The shipping policy is a preview only and was not saved.`
                  : 'Offer imported. No retail price was set; set it on the listing page before publishing.',
              listingId: listing.id,
            }
      );
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to import supplier offer',
      });
    } finally {
      setImportingOfferId(null);
    }
  };

  // Modal economics calculations (offer price is minor units; UI math in major units)
  const currency = selectedOffer?.price?.currency || 'SAR';
  const wholesaleMinorVal = minorAmount(selectedOffer?.price) ?? 0;
  const wholesaleVal = minorToMajor(wholesaleMinorVal, currency);
  const markupVal = parseFloat(markupPercent) || 0;
  const targetRetailVal = minorToMajor(Math.round(wholesaleMinorVal * (1 + markupVal / 100)), currency);
  const grossProfitVal = targetRetailVal - wholesaleVal;
  const shippingDeductionVal = shippingSubsidy === 'seller_free' ? parseFloat(estimatedShipping) || 0 : 0;
  const netProfitVal = grossProfitVal - shippingDeductionVal;
  const netProfitPercent = targetRetailVal > 0 ? (netProfitVal / targetRetailVal) * 100 : 0;
  const isUnsafeMargin = netProfitVal < 0;

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

      {/* Notification Banner */}
      {notification && (
        <div
          className={`flex items-start justify-between p-3 text-xs rounded-lg border ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
            {notification.listingId && (
              <Link
                href={`/dashboard/stores/${store_id}/catalog/listings`}
                className="underline font-medium ml-1 hover:text-emerald-700"
              >
                Go to Listings
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-xs opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

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
          {offers.map((offer) => {
            const importedListingId = importedOffers[offer.offer_id];
            return (
              <div key={offer.offer_id} className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{offer.product_name}</h3>
                    <div className="text-[11px] text-slate-500">Supplier: {offer.supplier_name}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {importedListingId && (
                      <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">
                        Imported
                      </span>
                    )}
                    <span className="bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200">
                      {offer.market_code}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-100">
                  <div>
                    <span className="text-slate-400">Offer Price:</span>
                    <div className="font-semibold text-slate-800">
                      {formatMoney(offer.price)}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400">Availability:</span>
                    <div className="font-semibold text-slate-800">
                      {offer.is_available ? `${offer.available_qty ?? 'In Stock'}` : 'Unavailable'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400">MOQ:</span>
                    <div className="font-semibold text-slate-800">{offer.minimum_order_quantity ?? 1}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">SKU:</span>
                    <div className="font-semibold text-slate-800">{offer.sku_code || 'N/A'}</div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={importingOfferId === offer.offer_id || !offer.is_available}
                  onClick={() => handleOpenImportModal(offer)}
                  className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    importedListingId
                      ? 'text-emerald-800 bg-emerald-100 hover:bg-emerald-200'
                      : 'text-white bg-amber-600 hover:bg-amber-700'
                  } disabled:opacity-50`}
                >
                  <Download className="w-3.5 h-3.5" />
                  {importingOfferId === offer.offer_id
                    ? 'Importing...'
                    : importedListingId
                    ? 'Re-configure Import'
                    : 'Import to Store Catalog'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Import Configuration Modal */}
      {selectedOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Download className="w-4 h-4 text-indigo-600" />
                Configure Supplier Offer Import & Markup
              </h3>
              <button
                type="button"
                onClick={() => setSelectedOffer(null)}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1 text-xs">
              <div className="font-semibold text-slate-900">{selectedOffer.product_name}</div>
              <div className="text-slate-500">Upstream Wholesale Cost: <span className="font-mono font-medium">{wholesaleVal.toFixed(2)} {currency}</span></div>
            </div>

            {/* Markup & Economics inputs */}
            <div className="space-y-3 text-xs p-3 bg-slate-50 border border-slate-200 rounded-md">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Target Markup Percentage (%)</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.5"
                      required
                      placeholder="20"
                      value={markupPercent}
                      onChange={(e) => setMarkupPercent(e.target.value)}
                      className="w-full pr-7 pl-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <Percent className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5" />
                  </div>
                  <div className="flex gap-1">
                    {[10, 15, 20, 30, 50].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setMarkupPercent(pct.toString())}
                        className="px-2 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100"
                      >
                        +{pct}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Shipping Subsidy Policy <span className="font-normal text-slate-500">(preview only — not saved)</span>
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="modal_shipping_policy"
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
                      name="modal_shipping_policy"
                      value="seller_free"
                      checked={shippingSubsidy === 'seller_free'}
                      onChange={() => setShippingSubsidy('seller_free')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    Seller-subsidized free shipping
                  </label>
                </div>
              </div>

              {shippingSubsidy === 'seller_free' && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Est. Shipping Cost per Order:</span>
                  <input
                    type="number"
                    step="0.5"
                    value={estimatedShipping}
                    onChange={(e) => setEstimatedShipping(e.target.value)}
                    className="w-24 px-2 py-1 text-xs border border-slate-300 rounded"
                  />
                  <span className="text-slate-500">{currency}</span>
                </div>
              )}
            </div>

            {/* Economics Live Summary */}
            <div className="p-3 bg-white border border-slate-200 rounded-md space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Target Retail Price</span>
                <span className="font-mono font-bold text-slate-900">{targetRetailVal.toFixed(2)} {currency}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Estimated Net Profit</span>
                <span className={`font-mono font-bold ${netProfitVal >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {netProfitVal.toFixed(2)} {currency} ({netProfitPercent.toFixed(1)}%)
                </span>
              </div>
            </div>

            {/* Margin Safety Warning */}
            {isUnsafeMargin && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-md flex items-start gap-2 text-xs text-rose-900">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Unsafe Margin Warning:</strong> Free shipping deduction exceeds gross markup profit. Increase your markup % to prevent net loss.
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedOffer(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(importingOfferId || isUnsafeMargin)}
                onClick={handleConfirmImport}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-md disabled:opacity-50"
              >
                {importingOfferId ? 'Importing...' : 'Confirm & Import to Store Catalog'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
