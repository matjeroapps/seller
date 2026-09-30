'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Container, PageHeader, Stack, Badge } from '@matjerhub/ui-sdk';
import { Store, Palette, Rocket, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Globe, Coins, ShieldCheck } from 'lucide-react';
import { ThemeSelectionCard, type ThemeOption } from './ThemeSelectionCard';
import { sellerApi } from '@/lib/api/client';

const THEMES: ThemeOption[] = [
  {
    key: 'default',
    name: 'Default',
    badge: 'Recommended',
    description: 'Clean, high-conversion layout optimized for high-volume retail, catalog browsing, and fast checkout.',
    features: ['High-contrast product grid', 'Optimized mobile bottom bar', 'Instant Buy Now buttons'],
    previewGradient: 'bg-gradient-to-br from-indigo-500/20 via-blue-500/20 to-slate-100'
  },
  {
    key: 'boutique',
    name: 'Boutique',
    badge: 'Editorial',
    description: 'Elegantly curated luxury showcase with generous photography, storytelling typography, and brand-first accents.',
    features: ['Editorial story layout', 'Accent typography & badges', 'Refined brand showcase'],
    previewGradient: 'bg-gradient-to-br from-amber-500/20 via-rose-500/20 to-stone-100'
  }
];

export function StoreOnboardingWizard() {
  const router = useRouter();

  // Wizard Step State (1: Store Basics, 2: Theme Selection, 3: Review & Submit)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [storeName, setStoreName] = useState('');
  const [storeSlug, setStoreSlug] = useState('');
  const [marketCode, setMarketCode] = useState('SA');
  const [currency, setCurrency] = useState('SAR');
  const [selectedTheme, setSelectedTheme] = useState('default');

  // UI / Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate slug helper from store name if user hasn't explicitly edited slug
  const handleNameChange = (val: string) => {
    setStoreName(val);
    if (!storeSlug || storeSlug === slugify(storeName)) {
      setStoreSlug(slugify(val));
    }
  };

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  // Validation
  const validateStep1 = () => {
    if (!storeName.trim()) {
      setError('Please enter a store name.');
      return false;
    }
    if (!storeSlug.trim()) {
      setError('Please enter a unique store URL slug.');
      return false;
    }
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(storeSlug)) {
      setError('Store slug must contain only lowercase letters, numbers, and single hyphens.');
      return false;
    }
    setError(null);
    return true;
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!validateStep1()) return;
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  };

  const handlePrevStep = () => {
    setError(null);
    if (currentStep === 2) setCurrentStep(1);
    if (currentStep === 3) setCurrentStep(2);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Create the store
      const createdStore = await sellerApi.createStore({
        name: storeName.trim(),
        code: storeSlug.trim(),
        market_code: marketCode,
        status: 'draft'
      });

      // 2. Install the selected theme
      if (selectedTheme) {
        try {
          await sellerApi.installTheme(createdStore.id, {
            theme_key: selectedTheme,
            version: '1.0.0'
          });
        } catch (themeErr) {
          console.warn('Initial theme install warning:', themeErr);
        }
      }

      // 3. Route directly to store dashboard
      router.push(`/dashboard/stores/${createdStore.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create store. Please check the slug for uniqueness and try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <Container size="md">
      <Stack gap="lg" className="py-8">
        {/* Header */}
        <PageHeader
          title="Welcome to MatjerHub"
          subtitle="Set up your merchant store in just a few quick steps to begin importing products and launching your storefront."
        />

        {/* Progress Stepper */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  currentStep >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                1
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-slate-900">Store Profile</p>
                <p className="text-[11px] text-slate-500">Name & Subdomain</p>
              </div>
            </div>

            <div className={`h-0.5 flex-1 mx-4 ${currentStep >= 2 ? 'bg-indigo-600' : 'bg-slate-200'}`} />

            <div className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  currentStep >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                2
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-slate-900">Storefront Theme</p>
                <p className="text-[11px] text-slate-500">Look & Feel</p>
              </div>
            </div>

            <div className={`h-0.5 flex-1 mx-4 ${currentStep >= 3 ? 'bg-indigo-600' : 'bg-slate-200'}`} />

            <div className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  currentStep >= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                3
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-slate-900">Review & Launch</p>
                <p className="text-[11px] text-slate-500">Confirm setup</p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {/* Step 1: Store Basics */}
        {currentStep === 1 && (
          <Card padding="lg" className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Store className="w-5 h-5 text-indigo-600" />
                Store Identity & Market
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure the primary identity, unique web address, and operating currency for your digital store.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Store Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Al-Nour Boutique"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <p className="text-[11px] text-slate-500 mt-1">This name will be displayed to shoppers on your storefront.</p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Store Subdomain Slug <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={storeSlug}
                    onChange={(e) => setStoreSlug(slugify(e.target.value))}
                    placeholder="al-nour-boutique"
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-l-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  <span className="px-3.5 py-2.5 bg-slate-100 border border-l-0 border-slate-200 text-xs font-medium text-slate-500 rounded-r-lg">
                    .matjerhub.local
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Unique subdomain URL for your store catalog. Lowercase letters, numbers, and hyphens only.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-500" />
                    Target Operating Market
                  </label>
                  <select
                    value={marketCode}
                    onChange={(e) => setMarketCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="SA">Saudi Arabia (SA) — المملكة العربية السعودية</option>
                    <option value="EG">Egypt (EG) — مصر</option>
                    <option value="AE">United Arab Emirates (AE) — الإمارات</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-slate-500" />
                    Primary Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="SAR">SAR — Saudi Riyal (ر.س)</option>
                    <option value="EGP">EGP — Egyptian Pound (ج.م)</option>
                    <option value="AED">AED — UAE Dirham (د.إ)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <Button variant="primary" onClick={handleNextStep} className="flex items-center gap-2">
                Choose Theme
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2: Theme Selection */}
        {currentStep === 2 && (
          <Card padding="lg" className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Palette className="w-5 h-5 text-indigo-600" />
                Select Initial Storefront Theme
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Choose the visual layout for your digital storefront. You can preview, customize, and switch themes anytime.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {THEMES.map((theme) => (
                <ThemeSelectionCard
                  key={theme.key}
                  theme={theme}
                  isSelected={selectedTheme === theme.key}
                  onSelect={(key) => setSelectedTheme(key)}
                />
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <Button variant="secondary" onClick={handlePrevStep} className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                Back
              </Button>
              <Button variant="primary" onClick={handleNextStep} className="flex items-center gap-2">
                Review Setup
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 3: Review & Submit */}
        {currentStep === 3 && (
          <Card padding="lg" className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Rocket className="w-5 h-5 text-indigo-600" />
                Review & Confirm Store Setup
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Verify your store details. Once initialized, you can import products from suppliers and prepare for launch.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Store Name</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{storeName}</p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Store Subdomain</span>
                  <p className="text-sm font-bold text-indigo-600 mt-0.5">
                    {storeSlug}.matjerhub.local
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Target Market & Currency</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {marketCode} · {currency}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Selected Theme</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5 capitalize">
                    {THEMES.find((t) => t.key === selectedTheme)?.name || selectedTheme} Theme
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/60 flex items-center gap-2 text-xs text-slate-600">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Store will be initialized securely with authenticated tenant boundaries.</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <Button variant="secondary" onClick={handlePrevStep} disabled={isSubmitting} className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                Back
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                {isSubmitting ? (
                  <>Initializing Store...</>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Create Store & Launch Dashboard
                  </>
                )}
              </Button>
            </div>
          </Card>
        )}
      </Stack>
    </Container>
  );
}
