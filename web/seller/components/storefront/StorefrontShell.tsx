'use client';

import { Badge, Button, Input } from '@matjerhub/ui-sdk';
import { Languages, Search, ShoppingBag, UserRound } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { directionForStorefront, storefrontLocales, type StorefrontData, type StorefrontLocale } from '@/lib/storefront/mock-data';

export function StorefrontShell({
  children,
  storefront,
  locale
}: {
  children: ReactNode;
  storefront: StorefrontData;
  locale: StorefrontLocale;
}) {
  const copy = storefront.copy[locale];
  const dir = directionForStorefront(locale);
  const basePath = `/store/${storefront.slug}`;
  const localeHref = (nextLocale: StorefrontLocale) => `${basePath}?lang=${nextLocale}`;

  return (
    <div className="storefront-shell" lang={locale} dir={dir}>
      <header className="storefront-header">
        <div className="storefront-header__bar">
          <Link href={`${basePath}?lang=${locale}`} className="storefront-brand" aria-label={`${storefront.name} ${copy.nav.home}`}>
            <span className="storefront-brand__logo" aria-hidden="true">
              {storefront.logo}
            </span>
            <span className="storefront-brand__name">{storefront.name}</span>
          </Link>

          <nav className="storefront-nav" aria-label={copy.nav.primary}>
            <Link href={`${basePath}?lang=${locale}`}>{copy.nav.home}</Link>
            <Link href={`${basePath}/products?lang=${locale}`}>{copy.nav.products}</Link>
            <Link href={`${basePath}/search?lang=${locale}`}>{copy.nav.search}</Link>
          </nav>

          <form action={`${basePath}/search`} className="storefront-header-search" role="search">
            <input type="hidden" name="lang" value={locale} />
            <Input
              name="q"
              aria-label={copy.search.label}
              placeholder={copy.search.placeholder}
              leftIcon={<Search aria-hidden="true" size={16} />}
            />
          </form>

          <div className="storefront-actions">
            <div className="storefront-language" aria-label={copy.nav.language}>
              <Languages aria-hidden="true" size={16} />
              {storefrontLocales.map((nextLocale) => (
                <Link
                  key={nextLocale}
                  href={localeHref(nextLocale)}
                  aria-current={nextLocale === locale ? 'true' : undefined}
                >
                  {storefront.copy[nextLocale].languageName}
                </Link>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" aria-label={copy.nav.account} leftIcon={<UserRound aria-hidden="true" size={16} />}>
              <span className="storefront-action-label">{copy.nav.account}</span>
            </Button>
            <Button type="button" variant="outline" size="sm" aria-label={copy.nav.cart} leftIcon={<ShoppingBag aria-hidden="true" size={16} />}>
              <span className="storefront-action-label">{copy.nav.cart}</span>
              <Badge variant="secondary">0</Badge>
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" className="storefront-main">
        {children}
      </main>

      <footer className="storefront-footer">
        <div>
          <strong>{storefront.name}</strong>
          <p>{copy.footer.tagline}</p>
        </div>
        <p>{copy.footer.rights}</p>
      </footer>
    </div>
  );
}
