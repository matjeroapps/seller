'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Badge, Card, Button } from '@matjerhub/ui-sdk';
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  Rocket,
  Store as StoreIcon,
  Palette,
  Truck,
  Layers,
  ArrowRight,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import type { Store, SellerListing, ThemeInstallation } from '@/lib/api/types';

interface StoreLaunchChecklistProps {
  store: Store;
  listings: SellerListing[];
  themeInstallation?: ThemeInstallation | null;
  storefrontHost?: string;
  onPublishStore: () => Promise<void>;
  isPublishing?: boolean;
}

export function StoreLaunchChecklist({
  store,
  listings,
  themeInstallation,
  storefrontHost,
  onPublishStore,
  isPublishing = false
}: StoreLaunchChecklistProps) {
  const [showReadinessModal, setShowReadinessModal] = useState(false);

  // Criteria calculations
  const hasStore = Boolean(store && store.name && store.code);
  const hasTheme = Boolean(themeInstallation?.theme_key);
  const hasImportedProducts = listings.length > 0;
  const hasPublishedListings = listings.some((l) => l.status === 'published');
  const isStorePublished = store.status === 'active';

  // 3-point gate: Store info + Theme + At least 1 active listing
  const isReadyToPublish = hasStore && hasTheme && hasPublishedListings;

  const steps = [
    {
      id: 'store_profile',
      title: 'Store Profile & Host Assigned',
      description: `${store.name} (${store.code}.matjerhub.local) in ${store.market_code}`,
      isComplete: hasStore,
      icon: StoreIcon,
      actionLabel: null,
      actionHref: null
    },
    {
      id: 'theme_setup',
      title: 'Storefront Theme Installed',
      description: themeInstallation?.theme_key
        ? `Active theme: ${themeInstallation.theme_key.toUpperCase()} (v${themeInstallation.version || '1.0.0'})`
        : 'Select and install your digital storefront theme layout',
      isComplete: hasTheme,
      icon: Palette,
      actionLabel: hasTheme ? 'Customize Theme' : 'Install Theme',
      actionHref: `/dashboard/stores/${store.id}/storefront`
    },
    {
      id: 'import_catalog',
      title: 'Import Supplier Products',
      description: hasImportedProducts
        ? `${listings.length} product listing${listings.length === 1 ? '' : 's'} imported from supplier catalog`
        : 'Browse wholesale offers and import your first product',
      isComplete: hasImportedProducts,
      icon: Truck,
      actionLabel: 'Browse Offers',
      actionHref: `/dashboard/stores/${store.id}/catalog/supplier-offers`
    },
    {
      id: 'publish_listings',
      title: 'Configure Retail Price & Presentation',
      description: hasPublishedListings
        ? `${listings.filter((l) => l.status === 'published').length} listing(s) ready and published in store catalog`
        : 'Set your retail price margins and publish at least one listing',
      isComplete: hasPublishedListings,
      icon: Layers,
      actionLabel: 'Manage Listings',
      actionHref: `/dashboard/stores/${store.id}/catalog/listings`
    }
  ];

  const completedCount = steps.filter((s) => s.isComplete).length + (isStorePublished ? 1 : 0);
  const totalCount = steps.length + 1;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const storefrontUrl = storefrontHost
    ? (storefrontHost.startsWith('http') ? storefrontHost : `http://${storefrontHost}:3000`)
    : `http://${store.code}.matjerhub.local:3000`;

  return (
    <Card padding="lg" className="border-indigo-100 bg-gradient-to-b from-white to-indigo-50/20 shadow-sm space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Rocket className="w-5 h-5 text-indigo-600" />
              Store Launch Checklist
            </h2>
            <Badge variant={isStorePublished ? 'default' : isReadyToPublish ? 'default' : 'secondary'}>
              {isStorePublished ? 'Live & Published' : isReadyToPublish ? 'Ready to Launch' : `${completedCount}/${totalCount} Steps`}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isStorePublished
              ? 'Your storefront is published and ready to accept customer orders.'
              : 'Complete the setup requirements below to publish your storefront to shoppers.'}
          </p>
        </div>

        {/* Action Button */}
        <div>
          {isStorePublished ? (
            <a
              href={storefrontUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 shadow-xs transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Visit Live Storefront
            </a>
          ) : isReadyToPublish ? (
            <Button
              variant="primary"
              onClick={onPublishStore}
              disabled={isPublishing}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Sparkles className="w-4 h-4" />
              {isPublishing ? 'Publishing Store...' : 'Publish Storefront'}
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => setShowReadinessModal(true)}
              className="flex items-center gap-1.5 text-xs text-slate-600"
            >
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Check Readiness
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-600 font-medium">
          <span>Launch Progress</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isStorePublished ? 'bg-emerald-500' : 'bg-indigo-600'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Steps List */}
      <div className="divide-y divide-slate-100 bg-white border border-slate-200/80 rounded-xl overflow-hidden">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 shrink-0">
                  {step.isComplete ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-xs font-bold ${step.isComplete ? 'text-slate-900' : 'text-slate-700'}`}>
                      {step.title}
                    </p>
                    {step.isComplete && <Badge variant="secondary" className="text-[10px] py-0">Completed</Badge>}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">{step.description}</p>
                </div>
              </div>

              {step.actionHref && (
                <div className="shrink-0">
                  <Link
                    href={step.actionHref}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      step.isComplete
                        ? 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                        : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                    }`}
                  >
                    <span>{step.actionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Readiness Check Modal */}
      {showReadinessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Publish Readiness Gate</h3>
                <p className="text-xs text-slate-500">Satisfy all 3 criteria before publishing:</p>
              </div>
            </div>

            <div className="space-y-2.5 bg-slate-50 p-4 rounded-xl text-xs">
              <div className="flex items-center gap-2">
                {hasStore ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Circle className="w-4 h-4 text-slate-300" />}
                <span className={hasStore ? 'text-slate-800 font-medium' : 'text-slate-500'}>
                  1. Valid store name & unique subdomain assigned
                </span>
              </div>
              <div className="flex items-center gap-2">
                {hasTheme ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Circle className="w-4 h-4 text-slate-300" />}
                <span className={hasTheme ? 'text-slate-800 font-medium' : 'text-slate-500'}>
                  2. Active storefront theme installed
                </span>
              </div>
              <div className="flex items-center gap-2">
                {hasPublishedListings ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-300" />
                )}
                <span className={hasPublishedListings ? 'text-slate-800 font-medium' : 'text-slate-500 font-medium text-amber-800'}>
                  3. At least 1 active/published product in catalog
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowReadinessModal(false)}>
                Close
              </Button>
              {!hasPublishedListings && (
                <Link
                  href={`/dashboard/stores/${store.id}/catalog/supplier-offers`}
                  className="px-3.5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
                >
                  Import Products Now
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
