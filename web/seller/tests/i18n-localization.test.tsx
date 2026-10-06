import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import React from 'react';
import { LocaleProvider, useTranslation } from '@/lib/i18n/locale-context';
import { Header } from '@/components/seller/Header';

describe('Arabic Localization & RTL Switching (US5)', () => {
  beforeEach(() => {
    // Reset document attributes and cookie
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
    document.cookie = 'mh_locale=; max-age=0; path=/';
  });

  it('initializes with English locale and resolves English dictionary terms', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider initialLocale="en">{children}</LocaleProvider>
    );
    const { result } = renderHook(() => useTranslation(), { wrapper });

    expect(result.current.locale).toBe('en');
    expect(result.current.direction).toBe('ltr');
    expect(result.current.isRtl).toBe(false);
    expect(result.current.t('common.save')).toBe('Save');
    expect(result.current.t('nav.inventory')).toBe('Inventory');
    expect(result.current.t('catalog.unsafeMarginWarning')).toBe('Unsafe Margin Warning');
    expect(result.current.t('nonexistent.key', 'Fallback')).toBe('Fallback');
  });

  it('switches to Arabic locale, sets RTL direction, and stores mh_locale cookie', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider initialLocale="en">{children}</LocaleProvider>
    );
    const { result } = renderHook(() => useTranslation(), { wrapper });

    act(() => {
      result.current.setLocale('ar');
    });

    expect(result.current.locale).toBe('ar');
    expect(result.current.direction).toBe('rtl');
    expect(result.current.isRtl).toBe(true);
    expect(result.current.t('common.save')).toBe('حفظ');
    expect(result.current.t('nav.inventory')).toBe('المخزون');
    expect(result.current.t('catalog.unsafeMarginWarning')).toBe('تحذير: هامش ربح غير آمن');

    // DOM document verification
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.cookie).toContain('mh_locale=ar');
  });

  it('reads mh_locale cookie on initialization', () => {
    document.cookie = 'mh_locale=ar; path=/';
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider>{children}</LocaleProvider>
    );
    const { result } = renderHook(() => useTranslation(), { wrapper });

    expect(result.current.locale).toBe('ar');
    expect(result.current.direction).toBe('rtl');
    expect(result.current.isRtl).toBe(true);
    expect(result.current.t('common.create')).toBe('إنشاء');
  });

  it('toggles language between English and Arabic via Header language switch button', () => {
    render(
      <LocaleProvider initialLocale="en">
        <Header title="Store Operations" subtitle="Fulfillment and catalog" />
      </LocaleProvider>
    );

    // Initial state: English with button inviting to switch to Arabic
    const toggleButton = screen.getByRole('button', { name: /Switch to Arabic layout/i });
    expect(toggleButton).toHaveTextContent('العربية');
    expect(document.documentElement.dir).toBe('ltr');

    // Click to switch to Arabic
    fireEvent.click(toggleButton);

    // Button should now indicate English to switch back, and document is RTL
    expect(screen.getByRole('button', { name: /Switch to English layout/i })).toHaveTextContent('English');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.cookie).toContain('mh_locale=ar');

    // Click again to switch back to English
    fireEvent.click(screen.getByRole('button', { name: /Switch to English layout/i }));

    expect(screen.getByRole('button', { name: /Switch to Arabic layout/i })).toHaveTextContent('العربية');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
    expect(document.cookie).toContain('mh_locale=en');
  });
});
