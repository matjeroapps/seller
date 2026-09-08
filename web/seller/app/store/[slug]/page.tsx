import type { Metadata } from 'next';

import { StorefrontHome } from '@/components/storefront/StorefrontHome';
import { StorefrontShell } from '@/components/storefront/StorefrontShell';
import { getStorefront, normalizeLocale, storeStructuredData } from '@/lib/storefront/mock-data';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const storefront = getStorefront(slug);

  return {
    title: storefront.name,
    description: `Customer storefront foundation for ${storefront.name}.`
  };
}

export default async function StoreHomePage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const locale = normalizeLocale(query.lang);
  const storefront = getStorefront(slug);

  return (
    <StorefrontShell storefront={storefront} locale={locale}>
      <StorefrontHome storefront={storefront} locale={locale} />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(storeStructuredData(storefront)) }}
      />
    </StorefrontShell>
  );
}
