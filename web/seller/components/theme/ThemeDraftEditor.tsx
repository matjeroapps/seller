'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@matjerhub/ui-sdk';
import { Palette, Undo2, Save, Send, Sparkles, CheckCircle2 } from 'lucide-react';
import type { ThemeInstallationResponse } from '@/lib/api/types';

interface ThemeDraftEditorProps {
  themeInstallation: ThemeInstallationResponse | null;
  onSaveDraft: (config: Record<string, unknown>) => Promise<void>;
  onDiscardDraft: () => Promise<void>;
  onPublishDraft: () => Promise<void>;
  isSaving: boolean;
  isPublishing: boolean;
}

export function ThemeDraftEditor({
  themeInstallation,
  onSaveDraft,
  onDiscardDraft,
  onPublishDraft,
  isSaving,
  isPublishing
}: ThemeDraftEditorProps) {
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [accentColor, setAccentColor] = useState('#f59e0b');
  const [announcementBanner, setAnnouncementBanner] = useState('');
  const [heroHeading, setHeroHeading] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (themeInstallation) {
      const config = themeInstallation.draft_config || themeInstallation.published_config || {};
      setPrimaryColor((config.primary_color as string) || '#4f46e5');
      setAccentColor((config.accent_color as string) || '#f59e0b');
      setAnnouncementBanner((config.announcement_banner as string) || '');
      setHeroHeading((config.hero_heading as string) || '');
      setIsDirty(false);
    }
  }, [themeInstallation]);

  const handleFieldChange = (setter: (val: string) => void, val: string) => {
    setter(val);
    setIsDirty(true);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    await onSaveDraft({
      primary_color: primaryColor,
      accent_color: accentColor,
      announcement_banner: announcementBanner,
      hero_heading: heroHeading
    });
    setIsDirty(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleDiscard = async () => {
    await onDiscardDraft();
    setIsDirty(false);
  };

  const hasDraftChanges =
    themeInstallation && themeInstallation.draft_revision > themeInstallation.published_revision;

  return (
    <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-xs space-y-5" data-testid="theme-draft-editor">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Theme Customization (Draft Mode)</h2>
            <p className="text-xs text-slate-500">
              Customize your brand styling. Changes are saved to draft revision #{themeInstallation?.draft_revision || 1} and do not affect live customers until published.
            </p>
          </div>
        </div>

        {hasDraftChanges && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            Unpublished Draft Edits Pending
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Primary Brand Color */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Primary Brand Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => handleFieldChange(setPrimaryColor, e.target.value)}
              className="w-10 h-10 rounded-md border border-slate-300 cursor-pointer p-0.5"
              data-testid="input-primary-color"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => handleFieldChange(setPrimaryColor, e.target.value)}
              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-md font-mono"
            />
          </div>
        </div>

        {/* Accent Color */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Accent Highlight Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => handleFieldChange(setAccentColor, e.target.value)}
              className="w-10 h-10 rounded-md border border-slate-300 cursor-pointer p-0.5"
              data-testid="input-accent-color"
            />
            <input
              type="text"
              value={accentColor}
              onChange={(e) => handleFieldChange(setAccentColor, e.target.value)}
              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-md font-mono"
            />
          </div>
        </div>

        {/* Announcement Banner */}
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-semibold text-slate-700">Announcement Banner Text (Optional)</label>
          <input
            type="text"
            placeholder="e.g. Special Offer: Enjoy complimentary fast delivery on all orders!"
            value={announcementBanner}
            onChange={(e) => handleFieldChange(setAnnouncementBanner, e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
            data-testid="input-announcement-banner"
          />
        </div>

        {/* Hero Custom Heading */}
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-semibold text-slate-700">Storefront Hero Headline (Optional)</label>
          <input
            type="text"
            placeholder="e.g. Discover Handcrafted Quality & Curated Collections"
            value={heroHeading}
            onChange={(e) => handleFieldChange(setHeroHeading, e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
            data-testid="input-hero-heading"
          />
        </div>
      </div>

      {/* Editor Actions Footer */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="w-4 h-4" /> Draft saved successfully
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDiscard}
            disabled={!hasDraftChanges && !isDirty}
            className="text-xs flex items-center gap-1.5 text-slate-600"
            data-testid="btn-discard-draft"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Discard Changes</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="text-xs flex items-center gap-1.5 border border-slate-300"
            data-testid="btn-save-draft"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onPublishDraft}
            disabled={isPublishing || (!hasDraftChanges && !isDirty)}
            className="text-xs flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs"
            data-testid="btn-publish-draft"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isPublishing ? 'Publishing...' : 'Publish to Live Store'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
