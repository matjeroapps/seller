import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { dictionaries, dictionaryFor, directionFor, format, isLocale, locales } from '../src/i18n/locales';
import { matjeroDefaultTheme } from '../src/themes/matjero-default';
import { categoriesA, productPageA, storeA, storeB } from './fixtures/storefront';
import { listModel } from './support/models';
import { buildContext, renderInDocument } from './support/render';

const { Layout, ProductList, NotFound, Unavailable } = matjeroDefaultTheme.components;

/**
 * Localization tests.
 *
 * Direction is asserted on the rendered document element, not on a CSS rule, because
 * `dir` is what bidirectional text, logical properties and keyboard navigation follow.
 */

describe('locale foundation', () => {
  it('serves Arabic and English', () => {
    expect([...locales].sort()).toEqual(['ar', 'en']);
  });

  it('maps each locale to its writing direction', () => {
    expect(directionFor('ar')).toBe('rtl');
    expect(directionFor('en')).toBe('ltr');
  });

  it('recognizes only supported locales', () => {
    expect(isLocale('ar')).toBe(true);
    expect(isLocale('en')).toBe(true);
    for (const candidate of ['fr', 'AR', 'en-US', '', null, undefined, 42]) {
      expect(isLocale(candidate)).toBe(false);
    }
  });

  it('defines every string in both locales', () => {
    const flatten = (value: unknown, prefix = ''): string[] => {
      if (typeof value === 'string') {
        return [prefix];
      }
      if (value && typeof value === 'object') {
        return Object.entries(value).flatMap(([key, child]) =>
          flatten(child, prefix ? `${prefix}.${key}` : key)
        );
      }
      return [];
    };

    const english = flatten(dictionaries.en).sort();
    const arabic = flatten(dictionaries.ar).sort();

    expect(arabic).toEqual(english);
    expect(english.length).toBeGreaterThan(50);
  });

  it('translates every string, leaving no English in the Arabic dictionary', () => {
    const collect = (value: unknown): string[] =>
      typeof value === 'string'
        ? [value]
        : value && typeof value === 'object'
          ? Object.values(value).flatMap(collect)
          : [];

    const untranslated = collect(dictionaries.ar)
      // Placeholders are substituted with runtime values, so their Latin names are
      // not user-visible text.
      .map((value) => value.replace(/\{\w+\}/g, ''))
      // The language names deliberately keep their own script.
      .filter((value) => /[A-Za-z]/.test(value) && !['English', 'العربية'].includes(value));

    expect(untranslated).toEqual([]);
  });

  it('substitutes placeholders as text', () => {
    expect(format('Page {page} of {pages}', { page: 2, pages: 5 })).toBe('Page 2 of 5');
    expect(format('{count} products', { count: 0 })).toBe('0 products');
    // An unknown placeholder is left alone rather than becoming "undefined".
    expect(format('{a} and {b}', { a: 'x' })).toBe('x and {b}');
  });

  it('does not interpret a value as markup', () => {
    expect(format('Results for “{query}”', { query: '<script>alert(1)</script>' })).toBe(
      'Results for “<script>alert(1)</script>”'
    );
  });
});

describe('rendered document', () => {
  it('renders English content left to right', () => {
    const context = buildContext({ store: storeA, locale: 'en', categories: categoriesA });

    renderInDocument(
      <Layout context={context}>
        <ProductList context={context} model={listModel({ context, store: storeA, page: productPageA })} />
      </Layout>,
      'en'
    );

    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    // The link appears in both the desktop nav and the mobile menu, which is expected.
    expect(screen.getAllByRole('link', { name: 'Products' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { level: 1, name: 'Products' })).toBeInTheDocument();
  });

  it('renders Arabic content right to left', () => {
    const context = buildContext({ store: storeA, locale: 'ar', categories: categoriesA });

    renderInDocument(
      <Layout context={context}>
        <ProductList context={context} model={listModel({ context, store: storeA, page: productPageA })} />
      </Layout>,
      'ar'
    );

    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getAllByRole('link', { name: 'المنتجات' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { level: 1, name: 'المنتجات' })).toBeInTheDocument();
  });

  it('translates navigation and the locale switch', () => {
    const context = buildContext({ store: storeA, locale: 'ar', categories: categoriesA, currentPath: '/products' });

    renderInDocument(
      <Layout context={context}>
        <span />
      </Layout>,
      'ar'
    );

    expect(screen.getAllByRole('navigation', { name: 'التنقل الرئيسي' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('navigation', { name: 'اللغة' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'English' })[0]).toHaveAttribute('href', '/en/products');
    expect(screen.getAllByRole('link', { name: 'العربية' })[0]).toHaveAttribute('aria-current', 'true');
  });

  it('keeps catalog content in the language the API returned it in', () => {
    const context = buildContext({ store: storeA, locale: 'ar' });

    renderInDocument(<ProductList context={context} model={listModel({ context, store: storeA, page: productPageA })} />, 'ar');

    // Product names are not translated in the frontend; the API already localized them.
    expect(screen.getByRole('heading', { level: 3, name: 'Aurora desk lamp' })).toBeInTheDocument();
  });

  it('translates the empty state', () => {
    const context = buildContext({ store: storeA, locale: 'ar' });
    const model = listModel({ context, store: storeA, page: { items: [], pagination: { total: 0, limit: 24, offset: 0 } } });

    renderInDocument(<ProductList context={context} model={model} />, 'ar');

    expect(screen.getByRole('status')).toHaveTextContent('لا توجد منتجات بعد');
  });

  it('translates the 404 page', () => {
    const context = buildContext({ store: storeA, locale: 'ar' });

    renderInDocument(<NotFound context={context} />, 'ar');

    expect(screen.getByRole('heading', { level: 1, name: 'الصفحة غير موجودة' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'العودة إلى الرئيسية' })).toHaveAttribute('href', '/ar');
  });

  it('translates the unavailable page and sets its direction', () => {
    const { container } = renderInDocument(<Unavailable locale="ar" copy={dictionaryFor('ar')} />, 'ar');

    expect(screen.getByRole('heading', { level: 1, name: 'المتجر غير متاح' })).toBeInTheDocument();
    expect(container.querySelector('.standalone')).toHaveAttribute('dir', 'rtl');
  });

  it('builds the locale switch from the locales the store publishes', () => {
    const single = buildContext({ store: storeB, locale: 'en', availableLocales: ['en'] });

    renderInDocument(
      <Layout context={single}>
        <span />
      </Layout>,
      'en'
    );

    // A store with one locale gets no switch rather than a switch with one option.
    expect(screen.queryByRole('navigation', { name: 'Language' })).toBeNull();
  });
});
