import { matjeroDefaultTheme } from './matjero-default';
import { ThemeRegistry } from './registry';

/**
 * The application's theme registry.
 *
 * Registration happens here, once, at module scope. The registry holds only theme
 * definitions — no tenant state — so sharing it across requests is safe; which
 * theme a request renders with is decided per request from that request's store
 * bootstrap.
 *
 * A second theme is added by importing it and calling `register`. Nothing in the
 * page loaders, the API client or the view models changes, which is the property the
 * swap test exercises.
 */
export const themeRegistry = new ThemeRegistry().register(matjeroDefaultTheme, { asDefault: true });
