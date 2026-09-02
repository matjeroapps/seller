/**
 * Internal request headers.
 *
 * The proxy sets these on the inbound request so the render can read what only the
 * proxy knows. They are named with a shared prefix and every inbound header carrying
 * it is deleted before any is set, so a client can never forge one.
 *
 * The constants live in their own module because both the proxy bundle and the server
 * render need them, and neither should have to import the other.
 */

export const INTERNAL_HEADER_PREFIX = 'x-matjero-';

/** The locale segment of the current path, when it is a supported locale. */
export const LOCALE_HEADER = 'x-matjero-locale';

/** The path within the locale, e.g. `/products`. Empty for a locale home page. */
export const PATH_HEADER = 'x-matjero-path';

/** The single centralized URL parameter carrying the draft theme preview token. */
export const PREVIEW_PARAM = 'theme_preview';

/** Internal header carrying a validated draft theme preview token from proxy to render. */
export const PREVIEW_TOKEN_HEADER = 'x-matjero-preview-token';

/** Internal header indicating an invalid or malformed preview token was presented. */
export const PREVIEW_INVALID_HEADER = 'x-matjero-preview-invalid';
