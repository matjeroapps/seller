'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Store as StoreIcon, ExternalLink, Globe, ShieldCheck } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { Store } from '@/lib/api/types';

export default function StorefrontSettingsPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = use(params);

  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    sellerApi
      .getStores()
      .then((res) => {
        if (!isMounted) return;
        setStores(res.items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    return () => {
      isMounted = false;
    };
  }, [store_id]);

  const currentStore = stores.find((s) => s.id === store_id);

  // Canonical storefront host URL
  const canonicalStorefrontUrl =
    process.env.NEXT_PUBLIC_STOREFRONT_APP_URL || `http://store-a.localhost:3000`;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Canonical Storefront Settings</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Preview and manage customer-facing storefront presentation for {currentStore?.name || 'this store'}
        </p>
      </div>

      {/* Canonical Storefront Access Card */}
      <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Canonical Storefront Host</h2>
            <div className="text-xs text-slate-500">
              Resolved via Core domain host resolver: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">{canonicalStorefrontUrl}</code>
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 space-y-1">
          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Multi-Tenant Host Resolution Active
          </div>
          <p className="text-[11px] text-slate-500">
            Core resolves trusted storefront hosts to active store domains. Published listings and store revision changes reflect directly on the canonical storefront.
          </p>
        </div>

        <div className="pt-2">
          <a
            href={canonicalStorefrontUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm"
          >
            Open Canonical Customer Storefront <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
