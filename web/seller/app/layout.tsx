import '@matjerhub/ui-sdk/styles.css';
import './styles/globals.css';

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: {
    default: 'MatjerHub Seller Portal',
    template: '%s | MatjerHub Seller Portal'
  },
  description: 'Seller portal foundation for MatjerHub merchants.'
};

function localeFromAcceptLanguage(acceptLanguage: string | null) {
  const first = acceptLanguage?.split(',')[0]?.trim().toLowerCase() || 'en';
  return first.startsWith('ar') ? 'ar' : 'en';
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const locale = localeFromAcceptLanguage(requestHeaders.get('accept-language'));
  const direction = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={direction}>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
