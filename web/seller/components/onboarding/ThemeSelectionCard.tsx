'use client';

import React from 'react';
import { Badge, Card } from '@matjerhub/ui-sdk';
import { Check, Sparkles, LayoutTemplate } from 'lucide-react';

export interface ThemeOption {
  key: string;
  name: string;
  badge: string;
  description: string;
  features: string[];
  previewGradient: string;
}

interface ThemeSelectionCardProps {
  theme: ThemeOption;
  isSelected: boolean;
  onSelect: (key: string) => void;
}

export function ThemeSelectionCard({ theme, isSelected, onSelect }: ThemeSelectionCardProps) {
  return (
    <div
      onClick={() => onSelect(theme.key)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(theme.key);
        }
      }}
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      className={`cursor-pointer transition-all duration-200 rounded-xl border-2 p-5 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
        isSelected
          ? 'border-indigo-600 bg-indigo-50/40 shadow-sm ring-1 ring-indigo-600'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      {/* Visual Header Mockup */}
      <div className={`h-24 w-full rounded-lg mb-4 flex items-center justify-center relative overflow-hidden ${theme.previewGradient}`}>
        <div className="absolute inset-0 bg-black/5" />
        <div className="flex items-center gap-2 z-10 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-md shadow-xs">
          {theme.key === 'boutique' ? (
            <Sparkles className="w-4 h-4 text-amber-600" />
          ) : (
            <LayoutTemplate className="w-4 h-4 text-indigo-600" />
          )}
          <span className="text-xs font-semibold text-slate-800 tracking-wide uppercase">{theme.name} Theme</span>
        </div>
        {isSelected && (
          <div className="absolute top-2 right-2 rtl:right-auto rtl:left-2 bg-indigo-600 text-white rounded-full p-1 shadow-sm">
            <Check className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      {/* Info Block */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-bold text-slate-900">{theme.name}</h3>
          <Badge variant={isSelected ? 'default' : 'secondary'}>{theme.badge}</Badge>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed min-h-[36px]">{theme.description}</p>
      </div>

      {/* Feature Bullet List */}
      <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
        {theme.features.map((feature, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-indigo-600' : 'bg-slate-300'}`} />
            <span>{feature}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
