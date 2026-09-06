import { matjeroDefaultTheme } from './matjero-default';
import { matjeroBoutiqueTheme } from './matjero-boutique';
import { ThemeRegistry } from './registry';

/**
 * The application's theme registry.
 *
 * Registration happens here, once, at module scope. The registry holds only theme
 * definitions — no tenant state — so sharing it across requests is safe; which
 * theme a request renders with is decided per request from that request's store
 * bootstrap.
 */
export const themeRegistry = new ThemeRegistry()
  .register(matjeroDefaultTheme, { asDefault: true })
  .register(matjeroBoutiqueTheme);

