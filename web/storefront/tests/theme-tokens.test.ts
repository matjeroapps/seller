import { describe, expect, it } from 'vitest';
import { matjeroDefaultTokens } from '../src/themes/tokens/matjero-default.tokens';
import { matjeroBoutiqueTokens } from '../src/themes/tokens/matjero-boutique.tokens';
import { tokensToCssVariables } from '../src/themes/tokens';

describe('Theme Tokens System', () => {
  it('defines valid token maps for matjero-default and matjero-boutique', () => {
    for (const tokens of [matjeroDefaultTokens, matjeroBoutiqueTokens]) {
      expect(tokens.colors.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(tokens.colors.background).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(tokens.typography.body).toBeTruthy();
      expect(tokens.spacing.md).toBeTruthy();
      expect(tokens.radius.md).toBeTruthy();
    }
  });

  it('generates correct CSS variables from tokens', () => {
    const cssVars = tokensToCssVariables(matjeroDefaultTokens);

    expect(cssVars['--theme-primary']).toBe('#0f766e');
    expect(cssVars['--theme-background']).toBe('#ffffff');
    expect(cssVars['--theme-radius-md']).toBe('10px');
    expect(cssVars['--theme-spacing-md']).toBe('1rem');

    const boutiqueVars = tokensToCssVariables(matjeroBoutiqueTokens);
    expect(boutiqueVars['--theme-primary']).toBe('#44403c');
    expect(boutiqueVars['--theme-background']).toBe('#faf9f6');
    expect(boutiqueVars['--theme-radius-md']).toBe('8px');
  });
});
