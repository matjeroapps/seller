export type BuildPreviewUrlOptions = {
  host: string;
  protocol?: string;
  locale?: string;
  token: string;
};

export function validateStorefrontProtocol(rawProtocol?: string): string {
  const protocol = (rawProtocol || import.meta.env.VITE_STOREFRONT_PUBLIC_PROTOCOL || 'https')
    .toLowerCase()
    .replace(/:$/, '');
  if (protocol !== 'http' && protocol !== 'https') {
    throw new Error(`Invalid storefront protocol: ${protocol}. Only http and https are allowed.`);
  }
  return protocol;
}

export function validateBareHost(host: string): string {
  const trimmed = host.trim();
  if (!trimmed) {
    throw new Error('Host cannot be empty');
  }
  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('@') || trimmed.includes('?') || trimmed.includes('#')) {
    throw new Error(`Invalid bare host: ${trimmed}. Host must not contain path, query, hash, or credentials.`);
  }
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) {
    throw new Error(`Invalid host scheme injection: ${trimmed}`);
  }
  return trimmed;
}

export function buildPreviewUrl(options: BuildPreviewUrlOptions): string {
  const protocol = validateStorefrontProtocol(options.protocol);
  const host = validateBareHost(options.host);
  const locale = options.locale === 'ar' ? 'ar' : 'en';

  const baseUrl = `${protocol}://${host}/${locale}`;
  const url = new URL(baseUrl);
  url.searchParams.set('theme_preview', options.token);

  return url.toString();
}

export function openPreviewWindow(url: string): Window | null {
  return window.open(url, '_blank', 'noopener,noreferrer');
}
