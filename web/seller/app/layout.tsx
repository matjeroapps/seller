import '@matjerhub/ui-sdk/styles.css';
import './styles/globals.css';

import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import type { ReactNode } from 'react';
import { LocaleProvider, type Locale } from '@/lib/i18n/locale-context';

export const metadata: Metadata = {
  title: {
    default: 'MatjerHub Seller Portal',
    template: '%s | MatjerHub Seller Portal'
  },
  description: 'Seller portal foundation for MatjerHub merchants.'
};

function localeFromAcceptLanguage(acceptLanguage: string | null): Locale {
  const first = acceptLanguage?.split(',')[0]?.trim().toLowerCase() || 'en';
  return first.startsWith('ar') ? 'ar' : 'en';
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('mh_locale')?.value;
  const requestHeaders = await headers();

  const locale: Locale =
    cookieLocale === 'ar' || cookieLocale === 'en'
      ? (cookieLocale as Locale)
      : localeFromAcceptLanguage(requestHeaders.get('accept-language'));

  const direction = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={direction}>
      <body>
        <LocaleProvider initialLocale={locale}>
          <a className="skip-link" href="#main-content">
            Skip to content
          </a>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
