import { describe, expect, it } from 'vitest';

import { locales } from '../src/i18n/locales';
import { formatPrice, toProductCard, toThemeContext, topLevelCategories } from '../src/lib/view-models';
import { categoriesA, productItemA, productItemAOut, storeA, storeB } from './fixtures/storefront';
import { copyFor } from './support/render';

describe('price formatting', () => {
  it('renders minor units using the market currency', () => {
    const price = formatPrice({ amount_minor: 24900, currency: 'EGP' }, storeA.currency, 'en');

    expect(price.amountMinor).toBe(24900);
    expect(price.currency).toBe('EGP');
    expect(price.formatted).toContain('249.00');
  });

  it('honours a currency with a different minor unit', () => {
    const zeroDecimal = { code: 'JPY', symbol: '¥', minor_unit: 0 };

    expect(formatPrice({ amount_minor: 2490, currency: 'JPY' }, zeroDecimal, 'en').formatted).toContain('2,490');
  });

  it('formats the same amount in both locales', () => {
    for (const locale of locales) {
      const formatted = formatPrice({ amount_minor: 24900, currency: 'EGP' }, storeA.currency, locale).formatted;
      expect(formatted).toContain('249');
    }
  });

  it('falls back to the currency code when the runtime has no data for it', () => {
    const unknown = { code: 'XTS', symbol: 'XTS', minor_unit: 2 };

    expect(formatPrice({ amount_minor: 1000, currency: 'ZZZZ' }, unknown, 'en').formatted).toContain('10.00');
  });

  it('treats a missing amount as zero rather than rendering NaN', () => {
    const price = formatPrice({} as never, storeA.currency, 'en');

    expect(price.amountMinor).toBe(0);
    expect(price.formatted).not.toContain('NaN');
  });
});

describe('product card view model', () => {
  it('maps the public fields a card needs', () => {
    const card = toProductCard(productItemA, storeA.currency, 'en', copyFor('en'));

    expect(card).toMatchObject({
      slug: 'aurora-desk-lamp',
      name: 'Aurora desk lamp',
      summary: 'A warm, dimmable desk lamp.',
      available: true,
      availabilityLabel: 'In stock',
      href: '/en/products/aurora-desk-lamp'
    });
    expect(card.image).toEqual({
      uri: 'https://cdn.example/aurora.jpg',
      alt: 'Aurora desk lamp on a desk'
    });
  });

  it('labels availability in the active locale', () => {
    expect(toProductCard(productItemA, storeA.currency, 'ar', copyFor('ar')).availabilityLabel).toBe('متوفر');
    expect(toProductCard(productItemAOut, storeA.currency, 'ar', copyFor('ar')).availabilityLabel).toBe('غير متوفر');
  });

  it('uses the product name as alt text when the payload has none', () => {
    const card = toProductCard(
      { ...productItemA, image: { uri: 'https://cdn.example/a.jpg' } },
      storeA.currency,
      'en',
      copyFor('en')
    );

    expect(card.image?.alt).toBe('Aurora desk lamp');
  });

  it('drops an image whose URL is not safe to render', () => {
    const card = toProductCard(
      { ...productItemA, image: { uri: 'javascript:alert(1)' } },
      storeA.currency,
      'en',
      copyFor('en')
    );

    expect(card.image).toBeNull();
  });

  it('percent-encodes a slug into the product link', () => {
    const card = toProductCard({ ...productItemA, slug: 'a b/../c' }, storeA.currency, 'en', copyFor('en'));

    expect(card.href).toBe('/en/products/a%20b%2F..%2Fc');
  });
});

describe('category view models', () => {
  it('keeps only top-level categories for navigation', () => {
    const top = topLevelCategories(categoriesA, 'en');

    expect(top.map((category) => category.slug)).toEqual(['lighting', 'furniture']);
    expect(top[0].href).toBe('/en/categories/lighting');
  });

  it('bounds the navigation category count', () => {
    const many = Array.from({ length: 30 }, (_, index) => ({
      slug: `c-${index}`,
      name: `C ${index}`,
      product_count: 1
    }));

    expect(topLevelCategories(many, 'en')).toHaveLength(12);
  });
});

describe('theme context', () => {
  it('builds localized links and a locale switch that preserves the path', () => {
    const context = toThemeContext({
      store: storeA,
      locale: 'ar',
      availableLocales: ['ar', 'en'],
      categories: categoriesA,
      currentPath: '/products'
    });

    expect(context.links).toEqual({
      home: '/ar',
      products: '/ar/products',
      categories: '/ar/categories',
      search: '/ar/search'
    });
    expect(context.localeLinks).toEqual([
      { locale: 'ar', label: 'العربية', href: '/ar/products', current: true },
      { locale: 'en', label: 'English', href: '/en/products', current: false }
    ]);
    expect(context.direction).toBe('rtl');
  });

  it('carries store branding and the market currency', () => {
    const context = toThemeContext({
      store: storeB,
      locale: 'en',
      availableLocales: ['en'],
      categories: [],
      currentPath: ''
    });

    expect(context.branding).toMatchObject({ name: 'Store B', code: 'store-b' });
    expect(context.currency.code).toBe('SAR');
    expect(context.direction).toBe('ltr');
  });

  it('falls back to the store code when the store has no name', () => {
    const context = toThemeContext({
      store: { ...storeA, store_name: '' },
      locale: 'en',
      availableLocales: ['en'],
      categories: [],
      currentPath: ''
    });

    expect(context.branding.name).toBe('store-a');
  });

  it('applies the published theme settings when none are supplied', () => {
    const context = toThemeContext({
      store: storeA,
      locale: 'en',
      availableLocales: ['en'],
      categories: [],
      currentPath: ''
    });

    expect(context.settings.key).toBe('matjero-default');
    expect(context.settings.announcement?.text).toBe('Free delivery over 500');
  });
});
