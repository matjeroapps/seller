'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import enDict from '@/locales/en.json';
import arDict from '@/locales/ar.json';

export type Locale = 'en' | 'ar';
export type Direction = 'ltr' | 'rtl';

interface LocaleContextType {
  locale: Locale;
  direction: Direction;
  isRtl: boolean;
  setLocale: (nextLocale: Locale) => void;
  toggleLocale: () => void;
  t: (key: string, fallback?: string) => string;
}

const dictionaries: Record<Locale, any> = {
  en: enDict,
  ar: arDict,
};

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function resolveNestedKey(obj: any, path: string): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

const LocaleContext = createContext<LocaleContextType | null>(null);

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (initialLocale === 'en' || initialLocale === 'ar') return initialLocale;
    const fromCookie = getCookie('mh_locale');
    if (fromCookie === 'ar' || fromCookie === 'en') return fromCookie;
    if (typeof document !== 'undefined') {
      const htmlLang = document.documentElement.lang?.toLowerCase();
      if (htmlLang?.startsWith('ar')) return 'ar';
    }
    return 'en';
  });

  const direction: Direction = locale === 'ar' ? 'rtl' : 'ltr';
  const isRtl = direction === 'rtl';

  const applyLocaleToDom = useCallback((nextLocale: Locale) => {
    if (typeof document === 'undefined') return;
    const nextDir = nextLocale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = nextLocale;
    document.documentElement.dir = nextDir;
  }, []);

  const setLocale = useCallback(
    (nextLocale: Locale) => {
      setLocaleState(nextLocale);
      setCookie('mh_locale', nextLocale);
      applyLocaleToDom(nextLocale);
    },
    [applyLocaleToDom]
  );

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'ar' ? 'en' : 'ar');
  }, [locale, setLocale]);

  useEffect(() => {
    applyLocaleToDom(locale);
  }, [locale, applyLocaleToDom]);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const currentDict = dictionaries[locale] || dictionaries.en;
      const localized = resolveNestedKey(currentDict, key);
      if (localized) return localized;

      // Fall back to English
      const enValue = resolveNestedKey(dictionaries.en, key);
      if (enValue) return enValue;

      return fallback ?? key;
    },
    [locale]
  );

  return (
    <LocaleContext.Provider
      value={{
        locale,
        direction,
        isRtl,
        setLocale,
        toggleLocale,
        t,
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LocaleContext);
  if (!context) {
    // Provide a safe fallback if used outside of LocaleProvider
    return {
      locale: 'en' as Locale,
      direction: 'ltr' as Direction,
      isRtl: false,
      setLocale: () => {},
      toggleLocale: () => {},
      t: (key: string, fallback?: string) => fallback ?? key,
    };
  }
  return context;
}
