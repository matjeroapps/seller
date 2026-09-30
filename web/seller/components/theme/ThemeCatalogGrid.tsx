'use client';

import React, { useState } from 'react';
import { Badge, Button } from '@matjerhub/ui-sdk';
import { Check, Sparkles, LayoutTemplate, ExternalLink, Eye, ArrowRightLeft, Palette } from 'lucide-react';
import type { Theme, ThemeInstallation } from '@/lib/api/types';

export interface ThemeMeta {
  key: string;
  name: string;
  badge: string;
  description: string;
  features: string[];
  previewGradient: string;
}

export const REGISTERED_THEMES: ThemeMeta[] = [
  {
    key: 'default',
    name: 'Default Clean',
    badge: 'Standard / Recommended',
    description: 'Clean, high-performance product-centric catalog layout with optimized checkout pathways.',
    features: ['High-density grid layout', 'Fast mobile conversions', 'Subtle typography & clean contrast'],
    previewGradient: 'bg-gradient-to-br from-indigo-500/10 via-slate-100 to-indigo-100/30'
  },
  {
    key: 'boutique',
    name: 'Editorial Boutique',
    badge: 'Visual / Merchandising',
    description: 'Editorial-style storefront featuring immersive hero banners, brand storytelling, and luxury aesthetics.',
    features: ['Hero banner storytelling', 'Serif accent typography', 'Generous whitespace & rich media cards'],
    previewGradient: 'bg-gradient-to-br from-amber-500/15 via-rose-50 to-orange-100/30'
  }
];

interface ThemeCatalogGridProps {
  themes: Theme[];
  activeInstallation: ThemeInstallation | null;
  onPreviewTheme: (themeKey: string) => Promise<void>;
  onSelectForSwitch: (themeKey: string) => void;
  onCustomizeTheme?: (themeKey: string) => void;
  loadingPreview?: string | null;
}

export function ThemeCatalogGrid({
  themes,
  activeInstallation,
  onPreviewTheme,
  onSelectForSwitch,
  onCustomizeTheme,
  loadingPreview
}: ThemeCatalogGridProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Registered Theme Catalog</h2>
          <p className="text-xs text-slate-500">
            Browse and switch platform themes. Preview changes live with your real store catalog before publishing.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {REGISTERED_THEMES.map((themeMeta) => {
          const isActive = activeInstallation?.theme_key === themeMeta.key;
          const isPreviewing = loadingPreview === themeMeta.key;

          return (
            <div
              key={themeMeta.key}
              data-testid={`theme-card-${themeMeta.key}`}
              className={`relative rounded-xl border-2 p-5 transition-all duration-200 bg-white ${
                isActive
                  ? 'border-indigo-600 shadow-sm ring-1 ring-indigo-600/30'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              {/* Visual Banner */}
              <div
                className={`h-28 w-full rounded-lg mb-4 flex items-center justify-center relative overflow-hidden border border-slate-100 ${themeMeta.previewGradient}`}
              >
                <div className="flex items-center gap-2 z-10 px-3.5 py-1.5 bg-white/95 backdrop-blur-xs rounded-md shadow-xs border border-slate-100">
                  {themeMeta.key === 'boutique' ? (
                    <Sparkles className="w-4 h-4 text-amber-600" />
                  ) : (
                    <LayoutTemplate className="w-4 h-4 text-indigo-600" />
                  )}
                  <span className="text-xs font-bold text-slate-800 tracking-wide">{themeMeta.name}</span>
                </div>

                {isActive && (
                  <div className="absolute top-2.5 right-2.5 rtl:right-auto rtl:left-2.5 flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white text-[11px] font-semibold rounded-full shadow-xs">
                    <Check className="w-3.5 h-3.5" />
                    <span>Active Published Theme</span>
                  </div>
                )}
              </div>

              {/* Theme Details */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-slate-900">{themeMeta.name}</h3>
                  <Badge variant={isActive ? 'default' : 'secondary'}>{themeMeta.badge}</Badge>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed min-h-[38px]">{themeMeta.description}</p>
              </div>

              {/* Features List */}
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                {themeMeta.features.map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-500">
                    <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              {/* Action Controls */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPreviewTheme(themeMeta.key)}
                  disabled={Boolean(loadingPreview)}
                  className="text-xs flex items-center gap-1.5"
                  data-testid={`preview-btn-${themeMeta.key}`}
                >
                  <Eye className="w-3.5 h-3.5 text-slate-600" />
                  <span>{isPreviewing ? 'Opening Preview...' : 'Preview Theme'}</span>
                </Button>

                <div className="flex items-center gap-2">
                  {isActive ? (
                    onCustomizeTheme && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onCustomizeTheme(themeMeta.key)}
                        className="text-xs flex items-center gap-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200"
                        data-testid={`customize-btn-${themeMeta.key}`}
                      >
                        <Palette className="w-3.5 h-3.5" />
                        <span>Customize Settings</span>
                      </Button>
                    )
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onSelectForSwitch(themeMeta.key)}
                      className="text-xs flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                      data-testid={`switch-btn-${themeMeta.key}`}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Switch to Theme</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
