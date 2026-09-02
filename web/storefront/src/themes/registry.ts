import type { ThemeDefinition } from './contract';

/**
 * The theme registry.
 *
 * It maps a `(key, version)` pair — the two identifiers the storefront bootstrap
 * publishes — onto a component set. Nothing else about a theme is executable: a
 * theme is code that ships inside this application and is selected by data, never
 * code supplied by a seller.
 *
 * Resolution is deliberately strict. A store pinned to a version no registered
 * component set declares support for does not fall back to a different version,
 * because a configuration written against one version is not safe to render with
 * another. It resolves to `unsupported_version`, and the caller renders the generic
 * unavailable state instead of a plausible-looking wrong page.
 */

export type ThemeResolution =
  | { outcome: 'resolved'; theme: ThemeDefinition; requestedVersion: string }
  | { outcome: 'unknown_theme'; key: string }
  | { outcome: 'unsupported_version'; key: string; version: string };

export class ThemeRegistry {
  private readonly themes = new Map<string, ThemeDefinition>();
  private defaultKey: string | null = null;

  /**
   * register adds a theme. The first registration becomes the default, which is
   * what a store with no installed theme renders with.
   */
  register(definition: ThemeDefinition, options: { asDefault?: boolean } = {}): this {
    this.themes.set(definition.key, definition);
    if (options.asDefault || this.defaultKey === null) {
      this.defaultKey = definition.key;
    }
    return this;
  }

  has(key: string): boolean {
    return this.themes.has(key);
  }

  keys(): string[] {
    return [...this.themes.keys()];
  }

  /** The default theme. Used when a store has no theme installation at all. */
  default(): ThemeDefinition {
    if (this.defaultKey === null) {
      throw new Error('theme registry has no registered theme');
    }
    // Non-null: defaultKey is only ever set from a completed registration.
    return this.themes.get(this.defaultKey)!;
  }

  /**
   * resolve selects the component set for a published theme reference.
   *
   * `null` means the store has no theme installation, which is not an error: the
   * platform default renders with its own defaults. A present-but-unmatched
   * reference is an error, and is reported as one.
   */
  resolve(reference: { key: string; version: string } | null | undefined): ThemeResolution {
    if (!reference || !reference.key) {
      const theme = this.default();
      return { outcome: 'resolved', theme, requestedVersion: theme.versions[0] ?? '' };
    }

    const theme = this.themes.get(reference.key);
    if (!theme) {
      return { outcome: 'unknown_theme', key: reference.key };
    }
    if (!theme.versions.includes(reference.version)) {
      return { outcome: 'unsupported_version', key: reference.key, version: reference.version };
    }
    return { outcome: 'resolved', theme, requestedVersion: reference.version };
  }
}
