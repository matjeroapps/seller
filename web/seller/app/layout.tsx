import '@matjerhub/ui-sdk/styles.css';
import './styles/globals.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: {
    default: 'MatjerHub Seller Portal',
    template: '%s | MatjerHub Seller Portal'
  },
  description: 'Seller portal foundation for MatjerHub merchants.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
