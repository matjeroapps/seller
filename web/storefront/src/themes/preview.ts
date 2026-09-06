/**
 * Theme Preview Infrastructure Contracts.
 *
 * Interfaces allowing seller dashboard and storefront preview rendering
 * without triggering production state changes.
 */

export type ThemePreviewToken = {
  token: string;
  themeKey: string;
  themeVersion: string;
  configuration: Record<string, unknown>;
  expiresAt: number;
};

export type ThemePreviewOptions = {
  isPreview: boolean;
  previewToken?: string;
  draftConfiguration?: Record<string, unknown>;
};

export interface ThemePreviewContext {
  activePreview: ThemePreviewOptions | null;
  generatePreviewToken?: (themeKey: string, configuration: Record<string, unknown>) => Promise<string>;
  validatePreviewToken?: (token: string) => Promise<ThemePreviewToken | null>;
}
