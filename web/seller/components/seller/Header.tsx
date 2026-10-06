'use client';

import React from 'react';
import { Globe2 } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/locale-context';

export interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { locale, toggleLocale, direction, t } = useTranslation();

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
      <div>
        {title && <h1 className="text-lg font-bold text-slate-900">{title}</h1>}
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleLocale}
          aria-label={locale === 'en' ? 'Switch to Arabic layout' : 'Switch to English layout'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
        >
          <Globe2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{locale === 'en' ? 'العربية' : 'English'}</span>
        </button>
      </div>
    </header>
  );
}
