import type { Metadata } from 'next';

import { StorefrontShell } from '@/components/storefront/StorefrontShell';
import { StorefrontSearch } from '@/components/storefront/StorefrontSearch';
import { getStorefront, normalizeLocale } from '@/lib/storefront/mock-data';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const storefront = getStorefront(slug);

  return {
    title: `Search | ${storefront.name}`,
    description: `Search the ${storefront.name} storefront.`
  };
}

export default async function StoreSearchPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string; q?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const locale = normalizeLocale(query.lang);
  const storefront = getStorefront(slug);

  return (
    <StorefrontShell storefront={storefront} locale={locale}>
      <StorefrontSearch storefront={storefront} locale={locale} query={query.q || ''} />
    </StorefrontShell>
  );
}
