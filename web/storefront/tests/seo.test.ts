import { describe, expect, it } from 'vitest';

import { categoryDescription, languageAlternates, metadataForPage, productJsonLd, publicOrigin, seoPath } from '../src/server/seo';
import { storeA, productDetailA, categoriesA } from './fixtures/storefront';

describe('storefront SEO', () => {
  it('builds clean, encoded paths', () => {
    expect(seoPath('home')).toBe('');
    expect(seoPath('products')).toBe('/products');
    expect(seoPath('category', 'desk lamps')).toBe('/categories/desk%20lamps');
    expect(seoPath('product', 'aurora/desk-lamp')).toBe('/products/aurora%2Fdesk-lamp');
  });

  it('keeps alternates tenant-scoped and limited to published locales', () => {
    const alternates = languageAlternates(publicOrigin('store-a.example'), storeA, '/products');

    expect(alternates).toEqual({
      ar: 'https://store-a.example/ar/products',
      en: 'https://store-a.example/en/products',
      'x-default': 'https://store-a.example/ar/products'
    });
    expect(alternates.fr).toBeUndefined();
  });

  it('canonicalizes listings and noindexes search pages', async () => {
    const metadata = await metadataForPage({
      host: 'store-a.example',
      store: storeA,
      locale: 'en',
      page: 'search',
      title: 'Search | Store A',
      indexable: false
    });

    expect(metadata.alternates?.canonical).toBe('https://store-a.example/en/search');
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.openGraph?.url).toBe('https://store-a.example/en/search');
  });

  it('creates Product JSON-LD from public fields only', async () => {
    const jsonLd = await productJsonLd(
      { host: 'store-a.example', store: storeA, locale: 'en' },
      productDetailA
    );

    expect(jsonLd).toMatchObject({
      '@type': 'Product',
      name: 'Aurora desk lamp',
      url: 'https://store-a.example/en/products/aurora-desk-lamp',
      offers: {
        priceCurrency: 'EGP',
        price: 249,
        availability: 'https://schema.org/InStock'
      }
    });
    expect(jsonLd).not.toHaveProperty('supplier');
  });

  it('uses a truthful category fallback description', () => {
    expect(categoryDescription(categoriesA[0], storeA)).toBe('Lamps and fixtures');
    expect(categoryDescription({ ...categoriesA[0], description: undefined }, storeA)).toBe('Lighting at Store A');
  });

  it('sets noindex, nofollow and keeps clean canonical url during preview mode', async () => {
    const metadata = await metadataForPage({
      host: 'store-a.example',
      store: storeA,
      locale: 'en',
      page: 'product',
      slug: 'aurora-desk-lamp',
      title: 'Aurora desk lamp | Store A',
      previewToken: 'preview-token-123'
    });

    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates?.canonical).toBe('https://store-a.example/en/products/aurora-desk-lamp');
    expect(metadata.alternates?.canonical).not.toContain('preview-token-123');
  });

  it('omits Product JSON-LD during preview mode', async () => {
    const jsonLd = await productJsonLd(
      { host: 'store-a.example', store: storeA, locale: 'en' },
      productDetailA,
      undefined,
      'preview-token-123'
    );

    expect(jsonLd).toBeNull();
  });
});
