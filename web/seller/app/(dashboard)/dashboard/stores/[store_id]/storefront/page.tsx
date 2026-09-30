'use client';

import { useEffect, useState, use, useCallback } from 'react';
import { ExternalLink, Globe, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import { sellerApi } from '@/lib/api/client';
import type { Store, Theme, ThemeInstallationResponse } from '@/lib/api/types';
import { ThemeCatalogGrid } from '@/components/theme/ThemeCatalogGrid';
import { ThemeSwitchConfirmModal } from '@/components/theme/ThemeSwitchConfirmModal';
import { ThemeDraftEditor } from '@/components/theme/ThemeDraftEditor';

export default function StorefrontSettingsPage({ params }: { params: Promise<{ store_id: string }> }) {
  const { store_id } = use(params);

  const [stores, setStores] = useState<Store[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [themeInstallation, setThemeInstallation] = useState<ThemeInstallationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal and action states
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  const [targetSwitchThemeKey, setTargetSwitchThemeKey] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [loadingPreviewTheme, setLoadingPreviewTheme] = useState<string | null>(null);

  const fetchThemeData = useCallback(async () => {
    try {
      setErrorMessage(null);
      const [storesRes, themesRes, installRes] = await Promise.all([
        sellerApi.getStores().catch(() => ({ items: [] })),
        sellerApi.listThemes().catch(() => ({ items: [] })),
        sellerApi.getThemeInstallation(store_id).catch(() => null)
      ]);

      setStores(storesRes.items || []);
      setThemes(themesRes.items || []);
      setThemeInstallation(installRes);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load theme settings';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }, [store_id]);

  useEffect(() => {
    fetchThemeData();
  }, [fetchThemeData]);

  const currentStore = stores.find((s) => s.id === store_id);

  // Canonical storefront base URL
  const canonicalStorefrontUrl =
    process.env.NEXT_PUBLIC_STOREFRONT_APP_URL || `http://${currentStore?.code || 'store-a'}.localhost:3000`;

  // Preview Handler
  const handlePreviewTheme = async (themeKey: string) => {
    try {
      setLoadingPreviewTheme(themeKey);
      setErrorMessage(null);

      // Request signed preview token from Core via Seller BFF
      const previewRes = await sellerApi.createThemePreview(store_id);
      const previewToken = previewRes.token;

      // Construct storefront preview URL
      const previewUrl = new URL(canonicalStorefrontUrl);
      previewUrl.searchParams.set('theme_preview', previewToken);

      // Open live preview in a new window/tab
      window.open(previewUrl.toString(), '_blank', 'noopener,noreferrer');
      setSuccessMessage(`Preview launched for ${themeKey.toUpperCase()} theme in a new tab`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate theme preview token';
      setErrorMessage(msg);
    } finally {
      setLoadingPreviewTheme(null);
    }
  };

  // Open Switch Modal
  const handleSelectForSwitch = (themeKey: string) => {
    setTargetSwitchThemeKey(themeKey);
    setSwitchModalOpen(true);
  };

  // Execute Switch & Publish
  const handleConfirmSwitch = async () => {
    if (!targetSwitchThemeKey) return;
    try {
      setIsPublishing(true);
      setErrorMessage(null);

      // Install and activate the new theme
      await sellerApi.installTheme(store_id, {
        theme_key: targetSwitchThemeKey,
        version: '1.0.0'
      });

      // Atomically publish configuration
      await sellerApi.publishTheme(store_id);

      setSwitchModalOpen(false);
      setTargetSwitchThemeKey(null);
      setSuccessMessage(`Successfully switched active storefront theme to ${targetSwitchThemeKey.toUpperCase()}!`);
      setTimeout(() => setSuccessMessage(null), 4000);

      // Refresh state
      await fetchThemeData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to switch theme';
      setErrorMessage(msg);
    } finally {
      setIsPublishing(false);
    }
  };

  // Save Draft Customization
  const handleSaveDraft = async (config: Record<string, unknown>) => {
    try {
      setIsSavingDraft(true);
      setErrorMessage(null);
      const res = await sellerApi.updateThemeDraft(store_id, config);
      setThemeInstallation((prev) =>
        prev
          ? {
              ...prev,
              draft_config: res.config,
              draft_revision: res.revision
            }
          : null
      );
      setSuccessMessage('Draft theme settings saved. Preview or publish when ready.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save draft settings';
      setErrorMessage(msg);
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Discard Draft
  const handleDiscardDraft = async () => {
    try {
      setErrorMessage(null);
      const res = await sellerApi.discardThemeDraft(store_id);
      setThemeInstallation((prev) =>
        prev
          ? {
              ...prev,
              draft_config: res.config,
              draft_revision: res.revision
            }
          : null
      );
      setSuccessMessage('Draft changes discarded. Reverted to published baseline.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to discard draft';
      setErrorMessage(msg);
    }
  };

  // Publish Draft
  const handlePublishDraft = async () => {
    try {
      setIsPublishing(true);
      setErrorMessage(null);
      const res = await sellerApi.publishTheme(store_id);
      setThemeInstallation((prev) =>
        prev
          ? {
              ...prev,
              published_config: prev.draft_config || prev.published_config,
              published_revision: res.published_revision
            }
          : null
      );
      setSuccessMessage('Theme customizations successfully published to live storefront!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to publish theme';
      setErrorMessage(msg);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-7 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Canonical Storefront Settings</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage visual presentation, themes, customize brand styling in draft mode, and preview changes with live merchant catalog data for {currentStore?.name || 'this store'}.
        </p>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2.5 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5 text-xs text-emerald-800">
          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Canonical Storefront Host Info Card */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Canonical Storefront Host</h2>
              <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <span>Resolved via Core domain host resolver:</span>
                <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-[11px] text-slate-800">
                  {canonicalStorefrontUrl}
                </code>
              </div>
            </div>
          </div>

          <a
            href={canonicalStorefrontUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-xs"
          >
            Open Canonical Customer Storefront <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Active Theme:{' '}
              <strong className="text-slate-900 capitalize">
                {themeInstallation?.installation.theme_key || 'Default'}
              </strong>{' '}
              (Revision #{themeInstallation?.published_revision || 1})
            </span>
          </div>
          <span className="text-[11px] text-slate-500">Atomic host resolution active</span>
        </div>
      </div>

      {/* Theme Catalog Grid */}
      <ThemeCatalogGrid
        themes={themes}
        activeInstallation={themeInstallation?.installation || null}
        onPreviewTheme={handlePreviewTheme}
        onSelectForSwitch={handleSelectForSwitch}
        onCustomizeTheme={() => {
          const el = document.getElementById('theme-draft-customizer');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
        loadingPreview={loadingPreviewTheme}
      />

      {/* Draft Customization Editor */}
      <div id="theme-draft-customizer">
        <ThemeDraftEditor
          themeInstallation={themeInstallation}
          onSaveDraft={handleSaveDraft}
          onDiscardDraft={handleDiscardDraft}
          onPublishDraft={handlePublishDraft}
          isSaving={isSavingDraft}
          isPublishing={isPublishing}
        />
      </div>

      {/* Switch Confirmation Modal */}
      <ThemeSwitchConfirmModal
        isOpen={switchModalOpen}
        targetThemeKey={targetSwitchThemeKey}
        currentThemeKey={themeInstallation?.installation.theme_key}
        onConfirm={handleConfirmSwitch}
        onClose={() => {
          if (!isPublishing) {
            setSwitchModalOpen(false);
            setTargetSwitchThemeKey(null);
          }
        }}
        isPublishing={isPublishing}
      />
    </div>
  );
}
