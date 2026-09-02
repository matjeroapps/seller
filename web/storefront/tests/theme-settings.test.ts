import { describe, expect, it } from 'vitest';

import { normalizeThemeSettings, cssVariablesFor, safeUrl } from '../src/themes/settings';
import { PLATFORM_DEFAULT_THEME } from '../src/lib/view-models';
import { storeA, themeA } from './fixtures/storefront';
import type { StoreTheme } from '../src/lib/contracts';

const fallback = PLATFORM_DEFAULT_THEME;

function themeWith(configuration: Record<string, unknown>): StoreTheme {
  return { key: 'matjero-default', version: '1.0.0', configuration, configuration_revision: 1 };
}

describe('theme settings', () => {
  it('applies the published configuration', () => {
    const settings = normalizeThemeSettings(themeA, fallback);

    expect(settings.key).toBe('matjero-default');
    expect(settings.version).toBe('1.0.0');
    expect(settings.revision).toBe(4);
    expect(settings.tokens.colorPrimary).toBe('#0f766e');
    expect(settings.headerLayout).toBe('classic');
    expect(settings.showSearch).toBe(true);
    expect(settings.footerColumns).toBe(3);
    expect(settings.announcement).toEqual({
      text: 'Free delivery over 500',
      backgroundColor: '#0f766e',
      textColor: '#ffffff'
    });
    expect(settings.hero?.title).toBe('Everything for the modern home');
    expect(settings.homepageSections).toEqual([
      { kind: 'featured', title: 'Featured' },
      { kind: 'category_grid', title: 'Browse categories' }
    ]);
  });

  it('fills in defaults for a store that published nothing', () => {
    const settings = normalizeThemeSettings(themeWith({}), fallback);

    expect(settings.tokens).toEqual({
      colorPrimary: '#0f766e',
      colorSecondary: '#0d9488',
      colorBackground: '#ffffff',
      colorText: '#0f172a',
      fontBody: 'Inter, system-ui, sans-serif',
      baseSize: 'medium',
      spacing: 'comfortable'
    });
    expect(settings.headerLayout).toBe('classic');
    expect(settings.navigationStyle).toBe('horizontal');
    expect(settings.footerColumns).toBe(3);
    expect(settings.productCardLayout).toBe('detailed');
    expect(settings.categoryLayout).toBe('grid');
    // A storefront with no configured sections still needs something to sell.
    expect(settings.homepageSections).toEqual([{ kind: 'featured', title: '' }]);
  });

  it('describes the platform default when the store has no theme installation', () => {
    const settings = normalizeThemeSettings(null, fallback);

    expect(settings.key).toBe('matjero-default');
    expect(settings.version).toBe('1.0.0');
    expect(settings.revision).toBe(0);
    expect(settings.tokens.colorPrimary).toBe('#0f766e');
  });

  it('rejects a color that is not a six-digit hex value', () => {
    const settings = normalizeThemeSettings(
      themeWith({
        colors: {
          primary: 'red',
          secondary: '#abc',
          background: 'rgb(0,0,0)',
          text: '#12345g'
        }
      }),
      fallback
    );

    expect(settings.tokens.colorPrimary).toBe('#0f766e');
    expect(settings.tokens.colorSecondary).toBe('#0d9488');
    expect(settings.tokens.colorBackground).toBe('#ffffff');
    expect(settings.tokens.colorText).toBe('#0f172a');
  });

  it('rejects a font stack that could terminate a CSS declaration', () => {
    for (const font of [
      'Inter; } body { display: none } .x {',
      'url(https://evil.example/f.css)',
      'Inter</style><script>alert(1)</script>'
    ]) {
      const settings = normalizeThemeSettings(themeWith({ typography: { font_family: font } }), fallback);
      expect(settings.tokens.fontBody).toBe('Inter, system-ui, sans-serif');
    }
  });

  it('rejects an unsafe URL in every URL-bearing field', () => {
    const settings = normalizeThemeSettings(
      themeWith({
        logo: 'javascript:alert(1)',
        favicon: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
        hero: {
          title: 'Hero',
          image_url: '//evil.example/hero.jpg',
          cta_label: 'Go',
          cta_url: 'vbscript:msgbox(1)'
        }
      }),
      fallback
    );

    expect(settings.logoUrl).toBe('');
    expect(settings.faviconUrl).toBe('');
    expect(settings.hero?.imageUrl).toBe('');
    expect(settings.hero?.ctaUrl).toBe('');
    // A call to action with no usable target must not render as a dead button.
    expect(settings.hero?.ctaLabel).toBe('');
  });

  it('accepts http, https and rooted paths', () => {
    expect(safeUrl('https://cdn.example/a.png')).toBe('https://cdn.example/a.png');
    expect(safeUrl('http://cdn.example/a.png')).toBe('http://cdn.example/a.png');
    expect(safeUrl('/assets/logo.svg')).toBe('/assets/logo.svg');
    expect(safeUrl('')).toBe('');
    expect(safeUrl('not a url')).toBe('');
    expect(safeUrl('//cdn.example/a.png')).toBe('');
    expect(safeUrl('/a"><img src=x onerror=alert(1)>')).toBe('');
    expect(safeUrl('https://cdn.example/' + 'a'.repeat(2000))).toBe('');
  });

  it('strips control characters from configuration text', () => {
    const settings = normalizeThemeSettings(
      themeWith({ announcement_bar: { enabled: true, text: 'Sale\u0000 now\u001f on' } }),
      fallback
    );

    expect(settings.announcement?.text).toBe('Sale now on');
  });

  it('hides an announcement bar that is enabled but empty', () => {
    expect(normalizeThemeSettings(themeWith({ announcement_bar: { enabled: true, text: '   ' } }), fallback).announcement).toBeNull();
    expect(normalizeThemeSettings(themeWith({ announcement_bar: { enabled: false, text: 'hi' } }), fallback).announcement).toBeNull();
  });

  it('hides the hero when the default all-empty configuration is published', () => {
    const settings = normalizeThemeSettings(
      themeWith({ hero: { title: '', subtitle: '', image_url: '', cta_label: '', cta_url: '' } }),
      fallback
    );

    expect(settings.hero).toBeNull();
  });

  it('clamps footer columns to the schema range', () => {
    expect(normalizeThemeSettings(themeWith({ footer: { columns: 0 } }), fallback).footerColumns).toBe(3);
    expect(normalizeThemeSettings(themeWith({ footer: { columns: 9 } }), fallback).footerColumns).toBe(3);
    expect(normalizeThemeSettings(themeWith({ footer: { columns: 2.5 } }), fallback).footerColumns).toBe(3);
    expect(normalizeThemeSettings(themeWith({ footer: { columns: 1 } }), fallback).footerColumns).toBe(1);
    expect(normalizeThemeSettings(themeWith({ footer: { columns: 4 } }), fallback).footerColumns).toBe(4);
  });

  it('drops unknown enum values and unknown section kinds', () => {
    const settings = normalizeThemeSettings(
      themeWith({
        header: { layout: 'kiosk' },
        navigation: { style: 'mega' },
        spacing: 'roomy',
        product_card_layout: 'gallery',
        category_layout: 'masonry',
        typography: { base_size: 'huge' },
        homepage_sections: [{ type: 'iframe_embed', title: 'Nope' }, { type: 'featured', title: 'Yes' }]
      }),
      fallback
    );

    expect(settings.headerLayout).toBe('classic');
    expect(settings.navigationStyle).toBe('horizontal');
    expect(settings.tokens.spacing).toBe('comfortable');
    expect(settings.tokens.baseSize).toBe('medium');
    expect(settings.productCardLayout).toBe('detailed');
    expect(settings.categoryLayout).toBe('grid');
    expect(settings.homepageSections).toEqual([{ kind: 'featured', title: 'Yes' }]);
  });

  it('bounds the number of homepage sections', () => {
    const many = Array.from({ length: 40 }, () => ({ type: 'featured', title: 'S' }));
    const settings = normalizeThemeSettings(themeWith({ homepage_sections: many }), fallback);

    expect(settings.homepageSections).toHaveLength(8);
  });

  it('survives a configuration of the wrong shape entirely', () => {
    for (const configuration of [
      { colors: 'teal', header: 42, homepage_sections: 'featured', footer: null },
      { colors: [], typography: [], hero: 'yes' }
    ] as unknown as Record<string, unknown>[]) {
      const settings = normalizeThemeSettings(themeWith(configuration), fallback);
      expect(settings.tokens.colorPrimary).toBe('#0f766e');
      expect(settings.headerLayout).toBe('classic');
      expect(settings.homepageSections).toEqual([{ kind: 'featured', title: '' }]);
    }
  });

  it('maps tokens onto controlled CSS custom properties', () => {
    const settings = normalizeThemeSettings(storeA.theme, fallback);
    const variables = cssVariablesFor(settings.tokens) as Record<string, string>;

    expect(variables['--color-primary']).toBe('#0f766e');
    expect(variables['--color-background']).toBe('#ffffff');
    expect(variables['--color-text']).toBe('#0f172a');
    expect(variables['--font-body']).toBe('Inter, system-ui, sans-serif');
    expect(variables['--font-size-base']).toBe('16px');
    expect(variables['--spacing-section']).toBe('4rem');
  });

  it('scales typography and spacing tokens by the published choice', () => {
    const small = cssVariablesFor(
      normalizeThemeSettings(themeWith({ typography: { base_size: 'small' }, spacing: 'compact' }), fallback).tokens
    ) as Record<string, string>;

    expect(small['--font-size-base']).toBe('15px');
    expect(small['--spacing-section']).toBe('2.5rem');
  });
});
