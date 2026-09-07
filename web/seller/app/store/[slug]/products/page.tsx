import type { Metadata } from 'next';

import { ProductListing } from '@/components/storefront/ProductListing';
import { StorefrontShell } from '@/components/storefront/StorefrontShell';
import { getStorefront, normalizeLocale, productStructuredData } from '@/lib/storefront/mock-data';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const storefront = getStorefront(slug);

  return {
    title: `Products | ${storefront.name}`,
    description: `Browse products from ${storefront.name}.`
  };
}

export default async function StoreProductsPage({
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
      <ProductListing storefront={storefront} locale={locale} />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(storefront.products[locale].slice(0, 2).map((product) => productStructuredData(storefront, product)))
        }}
      />
    </StorefrontShell>
  );
}
