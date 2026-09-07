'use client';

import { Button, Card, EmptyState, Input } from '@matjerhub/ui-sdk';
import { Search } from 'lucide-react';
import Link from 'next/link';

import type { StorefrontData, StorefrontLocale } from '@/lib/storefront/mock-data';
import { ProductCard } from './ProductCard';

export function StorefrontSearch({
  storefront,
  locale,
  query
}: {
  storefront: StorefrontData;
  locale: StorefrontLocale;
  query: string;
}) {
  const copy = storefront.copy[locale];
  const normalizedQuery = query.trim().toLowerCase();
  const results = normalizedQuery
    ? storefront.products[locale].filter((product) =>
        [product.name, product.category, product.imageLabel].some((value) => value.toLowerCase().includes(normalizedQuery))
      )
    : [];
  const basePath = `/store/${storefront.slug}`;

  return (
    <div className="storefront-search-page">
      <section className="storefront-page-heading" aria-labelledby="search-heading">
        <h1 id="search-heading">{copy.search.title}</h1>
        <p>{copy.search.body}</p>
      </section>

      <Card className="storefront-search-card" padding="lg">
        <form action={`${basePath}/search`} role="search">
          <input type="hidden" name="lang" value={locale} />
          <Input
            name="q"
            label={copy.search.label}
            defaultValue={query}
            placeholder={copy.search.placeholder}
            leftIcon={<Search aria-hidden="true" size={16} />}
          />
          <Button type="submit" size="lg" leftIcon={<Search aria-hidden="true" size={16} />}>
            {copy.search.submit}
          </Button>
        </form>
      </Card>

      {!normalizedQuery ? (
        <EmptyState
          icon={<Search aria-hidden="true" size={36} />}
          title={copy.search.emptyTitle}
          description={copy.search.emptyBody}
        />
      ) : results.length === 0 ? (
        <div className="storefront-empty-with-suggestions">
          <EmptyState
            icon={<Search aria-hidden="true" size={36} />}
            title={copy.search.noResultsTitle}
            description={copy.search.noResultsBody}
          />
          <section aria-labelledby="search-suggestions">
            <h2 id="search-suggestions">{copy.search.suggestions}</h2>
            <div>
              {storefront.categories[locale].map((category) => (
                <Link key={category.id} href={`${basePath}/search?lang=${locale}&q=${encodeURIComponent(category.name)}`}>
                  {category.name}
                </Link>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <section className="storefront-section" aria-label={`${copy.search.title} results`}>
          <div className="storefront-product-grid">
            {results.map((product) => (
              <ProductCard key={product.id} copy={copy} product={product} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
