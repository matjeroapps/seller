'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Boxes, Filter, CheckCircle2, AlertCircle, Archive, ArrowUpRight } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { SellerListing } from '@/lib/api/types';
import { useTranslation } from '@/lib/i18n/locale-context';

export default function StoreListingsPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = use(params);
  const { t } = useTranslation();

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
          <h1 className="text-xl font-bold text-slate-900">{t('listings.title')}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{t('listings.subtitle')}</p>
        </div>
        <Link
          href={`/dashboard/stores/${store_id}/catalog/products`}
          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 self-start"
        >
          {t('listings.viewProducts')}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <Filter className="w-3.5 h-3.5" /> {t('listings.filterStatusLabel')}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1 text-xs border border-slate-200 rounded bg-slate-50 font-normal focus:outline-none"
          >
            <option value="all">{t('listings.allStatuses')}</option>
            <option value="draft">{t('listings.statusDraft')}</option>
            <option value="published">{t('listings.statusPublished')}</option>
            <option value="unpublished">{t('listings.statusUnpublished')}</option>
            <option value="archived">{t('listings.statusArchived')}</option>
          </select>
        </div>

        <div className="text-xs text-slate-500">
          {t('listings.showingPrefix')} <span className="font-semibold text-slate-800">{filteredListings.length}</span>{' '}
          {t('listings.showingSuffix').replace('{total}', String(listings.length))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 animate-pulse">{t('listings.loading')}</div>
        ) : filteredListings.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            {t('listings.emptyFiltered')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 font-semibold">
                <tr>
                  <th className="px-4 py-3">{t('listings.colListingId')}</th>
                  <th className="px-4 py-3">{t('listings.colProductId')}</th>
                  <th className="px-4 py-3">{t('listings.colSourceType')}</th>
                  <th className="px-4 py-3">{t('listings.colMarket')}</th>
                  <th className="px-4 py-3">{t('listings.colPublishStatus')}</th>
                  <th className="px-4 py-3">{t('listings.colAvailability')}</th>
                  <th className="px-4 py-3 text-right">{t('listings.colActions')}</th>
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
                          {t('listings.supplierBacked')}
                        </span>
                      ) : (
                        <span className="bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded text-[10px] font-medium border border-indigo-200">
                          {t('listings.sellerOwned')}
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
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {t('listings.activeSupply')}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-normal">
                          {l.status === 'draft' ? t('listings.draftUnpublished') : t('listings.inactive')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/stores/${store_id}/catalog/listings/${l.id}`}
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        {t('listings.manage')} <ArrowUpRight className="w-3 h-3" />
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
