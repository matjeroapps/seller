import { describe, expect, it } from 'vitest';

import { ThemeRegistry } from '../src/themes/registry';
import { matjeroDefaultTheme } from '../src/themes/matjero-default';
import { themeRegistry } from '../src/themes';
import type { ThemeDefinition } from '../src/themes/contract';

const stub: ThemeDefinition = {
  key: 'stub-theme',
  versions: ['2.0.0', '2.1.0'],
  components: matjeroDefaultTheme.components
};

describe('theme registry', () => {
  it('resolves the published key and version to a component set', () => {
    const registry = new ThemeRegistry().register(matjeroDefaultTheme);

    const resolution = registry.resolve({ key: 'matjero-default', version: '1.0.0' });

    expect(resolution).toMatchObject({ outcome: 'resolved', requestedVersion: '1.0.0' });
    expect(resolution.outcome === 'resolved' && resolution.theme.key).toBe('matjero-default');
  });

  it('falls back to the default theme when the store has no installation', () => {
    const registry = new ThemeRegistry().register(matjeroDefaultTheme, { asDefault: true });

    expect(registry.resolve(null)).toMatchObject({ outcome: 'resolved' });
    expect(registry.resolve(undefined)).toMatchObject({ outcome: 'resolved' });
    // An empty key is treated as no installation rather than as an unknown theme.
    expect(registry.resolve({ key: '', version: '' })).toMatchObject({ outcome: 'resolved' });
  });

  it('reports an unregistered theme key rather than substituting one', () => {
    const registry = new ThemeRegistry().register(matjeroDefaultTheme);

    expect(registry.resolve({ key: 'seller-uploaded-theme', version: '1.0.0' })).toEqual({
      outcome: 'unknown_theme',
      key: 'seller-uploaded-theme'
    });
  });

  it('refuses a version the registered component set does not declare', () => {
    const registry = new ThemeRegistry().register(matjeroDefaultTheme);

    // A configuration written against 2.0.0 is not safe to interpret with the 1.0.0
    // component set, so this must not silently resolve.
    expect(registry.resolve({ key: 'matjero-default', version: '2.0.0' })).toEqual({
      outcome: 'unsupported_version',
      key: 'matjero-default',
      version: '2.0.0'
    });
  });

  it('resolves every version a theme declares', () => {
    const registry = new ThemeRegistry().register(stub);

    for (const version of ['2.0.0', '2.1.0']) {
      expect(registry.resolve({ key: 'stub-theme', version })).toMatchObject({
        outcome: 'resolved',
        requestedVersion: version
      });
    }
    expect(registry.resolve({ key: 'stub-theme', version: '2.2.0' })).toMatchObject({
      outcome: 'unsupported_version'
    });
  });

  it('keeps the first registration as the default until one is declared', () => {
    const registry = new ThemeRegistry().register(matjeroDefaultTheme).register(stub);
    expect(registry.default().key).toBe('matjero-default');

    const overridden = new ThemeRegistry()
      .register(matjeroDefaultTheme)
      .register(stub, { asDefault: true });
    expect(overridden.default().key).toBe('stub-theme');
  });

  it('throws rather than guessing when nothing is registered', () => {
    expect(() => new ThemeRegistry().default()).toThrow(/no registered theme/);
  });

  it('registers the platform default theme in the application registry', () => {
    expect(themeRegistry.keys()).toContain('matjero-default');
    expect(themeRegistry.default().key).toBe('matjero-default');
    expect(themeRegistry.has('matjero-default')).toBe(true);
    expect(themeRegistry.has('nothing-like-this')).toBe(false);
  });
});
