import { PREVIEW_PARAM } from './headers';

/**
 * Checks whether an href is an external URL.
 *
 * External links (absolute http/https pointing elsewhere, protocol-relative,
 * mailto, tel, javascript) must never receive the preview token capability.
 */
export function isExternalHref(href: string): boolean {
  if (!href) {
    return false;
  }
  const trimmed = href.trim().toLowerCase();
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('javascript:')
  );
}

/**
 * previewAwareHref appends or preserves the `theme_preview` token on internal URLs
 * when preview mode is active.
 *
 * External links are left untouched so the capability token is never leaked.
 */
export function previewAwareHref(href: string, previewToken?: string | null): string {
  if (!href || !previewToken || isExternalHref(href)) {
    return href;
  }

  try {
    const dummyBase = 'http://localhost';
    const relativePath = href.startsWith('/') ? href : `/${href}`;
    const url = new URL(relativePath, dummyBase);

    url.searchParams.set(PREVIEW_PARAM, previewToken);

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}
