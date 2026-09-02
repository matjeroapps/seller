import { describe, expect, it } from 'vitest';
import { isExternalHref, previewAwareHref } from '../src/lib/preview';

describe('previewAwareHref', () => {
  it('returns original href when preview token is absent', () => {
    expect(previewAwareHref('/en/products')).toBe('/en/products');
    expect(previewAwareHref('/en/products/desk-lamp')).toBe('/en/products/desk-lamp');
    expect(previewAwareHref('/en/products?sort=price_asc')).toBe('/en/products?sort=price_asc');
  });

  it('appends theme_preview token to internal relative URLs', () => {
    expect(previewAwareHref('/en/products', 'preview-token-123')).toBe('/en/products?theme_preview=preview-token-123');
    expect(previewAwareHref('/en/categories/lighting', 'preview-token-123')).toBe(
      '/en/categories/lighting?theme_preview=preview-token-123'
    );
  });

  it('preserves existing query parameters when appending theme_preview token', () => {
    expect(previewAwareHref('/en/products?page=2&sort=price_asc', 'preview-token-123')).toBe(
      '/en/products?page=2&sort=price_asc&theme_preview=preview-token-123'
    );
  });

  it('replaces existing theme_preview parameter without duplicating it', () => {
    expect(previewAwareHref('/en/products?theme_preview=old-token', 'new-token-456')).toBe(
      '/en/products?theme_preview=new-token-456'
    );
  });

  it('never appends preview token to external URLs', () => {
    const externalUrls = [
      'https://external-supplier.example.com/item',
      'http://other-site.org/info',
      '//cdn.example.com/asset.jpg',
      'mailto:support@example.com',
      'tel:+123456789'
    ];

    for (const url of externalUrls) {
      expect(isExternalHref(url)).toBe(true);
      expect(previewAwareHref(url, 'secret-preview-token')).toBe(url);
    }
  });
});
