export type ThemeColorTokens = {
  background: string;
  foreground: string;
  primary: string;
  secondary: string;
  accent: string;
};

export type ThemeTypographyTokens = {
  heading: string;
  body: string;
};

export type ThemeSpacingTokens = {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
};

export type ThemeRadiusTokens = {
  sm: string;
  md: string;
  lg: string;
};

export type ThemeTokens = {
  colors: ThemeColorTokens;
  typography: ThemeTypographyTokens;
  spacing: ThemeSpacingTokens;
  radius: ThemeRadiusTokens;
};

export function tokensToCssVariables(tokens: ThemeTokens): Record<string, string> {
  return {
    '--theme-primary': tokens.colors.primary,
    '--theme-secondary': tokens.colors.secondary,
    '--theme-background': tokens.colors.background,
    '--theme-foreground': tokens.colors.foreground,
    '--theme-accent': tokens.colors.accent,
    '--theme-font-heading': tokens.typography.heading,
    '--theme-font-body': tokens.typography.body,
    '--theme-spacing-xs': tokens.spacing.xs,
    '--theme-spacing-sm': tokens.spacing.sm,
    '--theme-spacing-md': tokens.spacing.md,
    '--theme-spacing-lg': tokens.spacing.lg,
    '--theme-spacing-xl': tokens.spacing.xl,
    '--theme-radius-sm': tokens.radius.sm,
    '--theme-radius-md': tokens.radius.md,
    '--theme-radius-lg': tokens.radius.lg,
    // Backward compatibility mappings
    '--color-primary': tokens.colors.primary,
    '--color-secondary': tokens.colors.secondary,
    '--color-background': tokens.colors.background,
    '--color-text': tokens.colors.foreground,
    '--font-body': tokens.typography.body
  };
}
