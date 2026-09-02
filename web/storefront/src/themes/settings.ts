import type {
  AnnouncementBar,
  Hero,
  HomepageSection,
  HomepageSectionKind,
  ThemeSettings,
  ThemeTokens
} from './contract';
import type { StoreTheme } from '../lib/contracts';

/**
 * Theme configuration normalization.
 *
 * The published configuration is validated by Core against the theme version's JSON
 * Schema, so what arrives here is already schema-clean. This layer exists anyway,
 * for two reasons that are independent of Core.
 *
 * First, every configuration field is optional. A store may publish `{}` or a
 * single key, and a theme must not have to test each field before using it. This
 * turns a partial configuration into a fully populated one.
 *
 * Second, defence in depth. Configuration is data, never code: no value from it is
 * ever evaluated, injected as markup, or used as a raw stylesheet. Colors must match
 * a strict hex pattern before reaching a CSS variable, font names are restricted to
 * characters that cannot terminate a CSS declaration, and URLs are limited to
 * schemes that cannot execute. A value failing any check is replaced by the default
 * rather than sanitized into something almost-right.
 */

const DEFAULT_TOKENS: ThemeTokens = {
  colorPrimary: '#0f766e',
  colorSecondary: '#0d9488',
  colorBackground: '#ffffff',
  colorText: '#0f172a',
  fontBody: 'Inter, system-ui, sans-serif',
  baseSize: 'medium',
  spacing: 'comfortable'
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Font family names reach a CSS custom property, so the allowed alphabet excludes
 * every character that could close a declaration or open another rule.
 */
const SAFE_FONT_STACK = /^[a-zA-Z0-9 ,'"_-]{1,128}$/;

const HOMEPAGE_SECTION_KINDS: HomepageSectionKind[] = [
  'featured',
  'category_grid',
  'product_carousel'
];

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') {
    return '';
  }
  // Control characters are dropped: they carry no display meaning and can confuse
  // bidirectional text rendering.
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value.trim()) ? value.trim() : fallback;
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function integer(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return fallback;
  }
  return value < min || value > max ? fallback : value;
}

/**
 * safeUrl accepts only URLs that cannot execute.
 *
 * Absolute URLs are restricted to http and https. Root-relative paths are allowed
 * so a store can point at an asset served from its own origin. Everything else —
 * `javascript:`, `data:`, `vbscript:`, protocol-relative `//host`, a bare word — is
 * rejected. Core's validator blocks `javascript:` already; this makes the frontend
 * independently safe rather than dependent on that.
 */
export function safeUrl(value: unknown, maxLength = 1024): string {
  if (typeof value !== 'string') {
    return '';
  }
  const candidate = value.trim();
  if (!candidate || candidate.length > maxLength) {
    return '';
  }
  if (candidate.startsWith('//')) {
    return '';
  }
  if (candidate.startsWith('/')) {
    // A single-slash path cannot change origin or scheme.
    return /[\u0000-\u001f\u007f<>"'`\\]/.test(candidate) ? '' : candidate;
  }
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function tokensFrom(config: Record<string, unknown>): ThemeTokens {
  const colors = record(config.colors);
  const typography = record(config.typography);
  const fontFamily = typeof typography.font_family === 'string' ? typography.font_family.trim() : '';

  return {
    colorPrimary: color(colors.primary, DEFAULT_TOKENS.colorPrimary),
    colorSecondary: color(colors.secondary, DEFAULT_TOKENS.colorSecondary),
    colorBackground: color(colors.background, DEFAULT_TOKENS.colorBackground),
    colorText: color(colors.text, DEFAULT_TOKENS.colorText),
    fontBody: SAFE_FONT_STACK.test(fontFamily) ? fontFamily : DEFAULT_TOKENS.fontBody,
    baseSize: oneOf(typography.base_size, ['small', 'medium', 'large'] as const, 'medium'),
    spacing: oneOf(config.spacing, ['comfortable', 'compact'] as const, 'comfortable')
  };
}

function announcementFrom(config: Record<string, unknown>): AnnouncementBar | null {
  const bar = record(config.announcement_bar);
  if (!boolean(bar.enabled, false)) {
    return null;
  }
  const content = text(bar.text, 256);
  if (!content) {
    // Enabled but empty is nothing to announce, and an empty bar is a layout bug.
    return null;
  }
  return {
    text: content,
    backgroundColor: color(bar.background_color, DEFAULT_TOKENS.colorPrimary),
    textColor: color(bar.text_color, '#ffffff')
  };
}

function heroFrom(config: Record<string, unknown>): Hero | null {
  const hero = record(config.hero);
  const title = text(hero.title, 128);
  const subtitle = text(hero.subtitle, 256);
  const imageUrl = safeUrl(hero.image_url);
  if (!title && !subtitle && !imageUrl) {
    // The default configuration ships an all-empty hero. Rendering it would leave
    // a blank band at the top of every storefront.
    return null;
  }
  const ctaUrl = safeUrl(hero.cta_url);
  const ctaLabel = text(hero.cta_label, 64);
  return {
    title,
    subtitle,
    imageUrl,
    // A call to action needs both halves to be usable.
    ctaLabel: ctaUrl ? ctaLabel : '',
    ctaUrl: ctaLabel ? ctaUrl : ''
  };
}

/** Bounds the number of homepage sections. The schema sets no maximum. */
const MAX_HOMEPAGE_SECTIONS = 8;

function sectionsFrom(config: Record<string, unknown>): HomepageSection[] {
  const raw = Array.isArray(config.homepage_sections) ? config.homepage_sections : [];
  const sections: HomepageSection[] = [];

  for (const entry of raw.slice(0, MAX_HOMEPAGE_SECTIONS)) {
    const section = record(entry);
    if (typeof section.type !== 'string') {
      continue;
    }
    if (!HOMEPAGE_SECTION_KINDS.includes(section.type as HomepageSectionKind)) {
      continue;
    }
    sections.push({
      kind: section.type as HomepageSectionKind,
      title: text(section.title, 128)
    });
  }

  if (sections.length === 0) {
    // A storefront with no configured sections still needs something to sell.
    return [{ kind: 'featured', title: '' }];
  }
  return sections;
}

/**
 * normalizeThemeSettings turns a published theme reference into settings a theme
 * can render without any further checking.
 *
 * `theme` is null when the store has no installation; the platform defaults apply,
 * and `key`/`version` describe what actually rendered rather than what was asked
 * for.
 */
export function normalizeThemeSettings(
  theme: StoreTheme | null | undefined,
  fallback: { key: string; version: string }
): ThemeSettings {
  const config = record(theme?.configuration);
  const header = record(config.header);
  const footer = record(config.footer);
  const navigation = record(config.navigation);

  return {
    key: theme?.key || fallback.key,
    version: theme?.version || fallback.version,
    revision: typeof theme?.configuration_revision === 'number' ? theme.configuration_revision : 0,
    tokens: tokensFrom(config),
    logoUrl: safeUrl(config.logo, 512),
    faviconUrl: safeUrl(config.favicon, 512),
    announcement: announcementFrom(config),
    headerLayout: oneOf(header.layout, ['minimal', 'centered', 'classic'] as const, 'classic'),
    showSearch: boolean(header.show_search, true),
    navigationStyle: oneOf(navigation.style, ['horizontal', 'dropdown'] as const, 'horizontal'),
    footerColumns: integer(footer.columns, 1, 4, 3),
    hero: heroFrom(config),
    homepageSections: sectionsFrom(config),
    productCardLayout: oneOf(config.product_card_layout, ['compact', 'detailed'] as const, 'detailed'),
    categoryLayout: oneOf(config.category_layout, ['grid', 'list'] as const, 'grid')
  };
}

/**
 * cssVariablesFor maps tokens onto CSS custom properties.
 *
 * Every value passed here has already been validated, and the object is applied
 * through React's `style` prop rather than a stylesheet string, so no seller value
 * is ever parsed as CSS.
 */
export function cssVariablesFor(tokens: ThemeTokens): React.CSSProperties {
  const scale = { small: '15px', medium: '16px', large: '18px' }[tokens.baseSize];
  const section = tokens.spacing === 'compact' ? '2.5rem' : '4rem';

  return {
    '--color-primary': tokens.colorPrimary,
    '--color-secondary': tokens.colorSecondary,
    '--color-background': tokens.colorBackground,
    '--color-text': tokens.colorText,
    '--font-body': tokens.fontBody,
    '--font-size-base': scale,
    '--spacing-section': section
  } as React.CSSProperties;
}

export { DEFAULT_TOKENS };
