'use client';

import React from 'react';
import { Button } from '@matjerhub/ui-sdk';
import { AlertTriangle, ArrowRightLeft, X, ShieldCheck } from 'lucide-react';
import { REGISTERED_THEMES } from './ThemeCatalogGrid';

interface ThemeSwitchConfirmModalProps {
  isOpen: boolean;
  targetThemeKey: string | null;
  currentThemeKey?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  isPublishing: boolean;
}

export function ThemeSwitchConfirmModal({
  isOpen,
  targetThemeKey,
  currentThemeKey,
  onConfirm,
  onClose,
  isPublishing
}: ThemeSwitchConfirmModalProps) {
  if (!isOpen || !targetThemeKey) return null;

  const targetTheme = REGISTERED_THEMES.find((t) => t.key === targetThemeKey);
  const currentTheme = REGISTERED_THEMES.find((t) => t.key === currentThemeKey);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-switch-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 id="theme-switch-modal-title" className="text-sm font-bold text-slate-900">
                Confirm Store Theme Switch
              </h3>
              <p className="text-xs text-slate-500">Atomic storefront presentation update</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isPublishing}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs text-slate-600 leading-relaxed">
          <p>
            You are about to switch your active storefront presentation from{' '}
            <strong className="text-slate-900">{currentTheme?.name || currentThemeKey || 'Current Theme'}</strong> to{' '}
            <strong className="text-indigo-600">{targetTheme?.name || targetThemeKey}</strong>.
          </p>

          <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-lg space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-indigo-900">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Commerce Invariants Guaranteed
            </div>
            <p className="text-[11px] text-indigo-700">
              Switching themes strictly changes visual layout only. All product listings, prices, inventory reservations, customer carts, and orders will remain 100% untouched.
            </p>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-800">
              The public storefront will immediately begin serving the new theme and increment the store revision counter.
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isPublishing}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onConfirm}
            disabled={isPublishing}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 shadow-sm"
          >
            {isPublishing ? 'Publishing & Switching...' : `Switch & Publish ${targetTheme?.name || 'Theme'}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
