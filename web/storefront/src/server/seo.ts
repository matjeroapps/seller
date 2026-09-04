import 'server-only';

import type { Metadata } from 'next';
import { headers } from 'next/headers';

import type { Locale } from '../i18n/locales';
import type { CategoryNode, ProductDetail, StoreBootstrap } from '../lib/contracts';
import { localesFor } from './presentation';
import { runtimeConfig } from './config';

export type SeoPage = 'home' | 'products' | 'category' | 'product' | 'search';

export type SeoContext = {
  host: string;
  store: StoreBootstrap;
  locale: Locale;
};

function cleanText(value: string | undefined, fallback: string): string {
  const text = value?.replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function encodedSegment(value: string): string {
  return encodeURIComponent(value);
}

export function seoPath(page: SeoPage, slug?: string): string {
  switch (page) {
    case 'home':
      return '';
    case 'products':
      return '/products';
    case 'category':
      return `/categories/${encodedSegment(slug ?? '')}`;
    case 'product':
      return `/products/${encodedSegment(slug ?? '')}`;
    case 'search':
      return '/search';
  }
}

export function publicOrigin(
  host: string,
  protocol: 'http' | 'https' = runtimeConfig().publicProtocol ?? 'https'
): URL {
  return new URL(`${protocol}://${host}`);
}

/** Resolve the public scheme using the same explicit proxy trust decision as host resolution. */
export async function requestOrigin(host: string): Promise<URL> {
  const config = runtimeConfig();
  let protocol = config.publicProtocol ?? 'https';

  if (config.trustForwardedHost) {
    const forwardedProtocol = (await headers()).get('x-forwarded-proto')?.split(',')[0]?.trim();
    if (forwardedProtocol === 'http' || forwardedProtocol === 'https') {
      protocol = forwardedProtocol;
    }
  }

  return publicOrigin(host, protocol);
}

export function localizedUrl(origin: URL, locale: Locale, path: string): string {
  return new URL(`/${locale}${path}`, origin).toString();
}

export function languageAlternates(
  origin: URL,
  store: StoreBootstrap,
  path: string
): Record<string, string> {
  const supported = localesFor(store);
  const alternates = Object.fromEntries(
    supported.map((locale) => [locale, localizedUrl(origin, locale, path)])
  );
  const defaultLocale = supported[0];
  if (defaultLocale) {
    alternates['x-default'] = localizedUrl(origin, defaultLocale, path);
  }
  return alternates;
}

import { currentPreviewToken } from './store-context';

export async function metadataForPage({
  host,
  store,
  locale,
  page,
  slug,
  title,
  description,
  images = [],
  indexable = true,
  origin,
  previewToken
}: SeoContext & {
  page: SeoPage;
  slug?: string;
  title: string;
  description?: string;
  images?: string[];
  indexable?: boolean;
  origin?: URL;
  previewToken?: string | null;
}): Promise<Metadata> {
  const resolvedOrigin = origin ?? publicOrigin(host);
  const path = seoPath(page, slug);
  const canonical = localizedUrl(resolvedOrigin, locale, path);
  const safeDescription = cleanText(description, store.store_name);
  const safeImages = images.filter((image) => /^https?:\/\//i.test(image));
  const token = previewToken !== undefined ? previewToken : await currentPreviewToken();
  const isPreview = token !== undefined && token !== null && token !== '';

  return {
    metadataBase: resolvedOrigin,
    title,
    description: safeDescription,
    alternates: {
      canonical,
      languages: languageAlternates(resolvedOrigin, store, path)
    },
    robots: isPreview
      ? { index: false, follow: false }
      : indexable
        ? undefined
        : { index: false, follow: true },
    openGraph: {
      type: 'website',
      url: canonical,
      siteName: store.store_name,
      title,
      description: safeDescription,
      locale,
      images: safeImages
    },
    twitter: {
      card: safeImages.length > 0 ? 'summary_large_image' : 'summary',
      title,
      description: safeDescription,
      images: safeImages
    }
  };
}

export async function productJsonLd(
  context: SeoContext,
  product: ProductDetail,
  requestUrl: URL = publicOrigin(context.host),
  previewToken?: string | null
): Promise<Record<string, unknown> | null> {
  const token = previewToken !== undefined ? previewToken : await currentPreviewToken();
  if (token !== undefined && token !== null && token !== '') {
    return null;
  }

  const origin = requestUrl;
  const url = localizedUrl(origin, context.locale, seoPath('product', product.slug));
  const images = (product.images || [])
    .map((image) => image.uri)
    .filter((image) => /^https?:\/\//i.test(image));

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    ...(product.description ? { description: product.description } : {}),
    ...(images.length > 0 ? { image: images } : {}),
    url,
    offers: {
      '@type': 'Offer',
      priceCurrency: product.price.currency,
      price: product.price.amount_minor / 10 ** context.store.currency.minor_unit,
      availability:
        product.availability === 'in_stock'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      url
    }
  };
}

export function categoryDescription(category: CategoryNode, store: StoreBootstrap): string {
  return cleanText(category.description, `${category.name} at ${store.store_name}`);
}
