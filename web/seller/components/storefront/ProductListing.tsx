'use client';

import { Badge, Card } from '@matjerhub/ui-sdk';

import type { StorefrontData, StorefrontLocale } from '@/lib/storefront/mock-data';
import { ProductCard } from './ProductCard';

export function ProductListing({ storefront, locale }: { storefront: StorefrontData; locale: StorefrontLocale }) {
  const copy = storefront.copy[locale];
  const products = storefront.products[locale];

  return (
    <div className="storefront-listing">
      <section className="storefront-page-heading" aria-labelledby="products-heading">
        <Badge variant="secondary">{copy.products.mockCount.replace('{count}', String(products.length))}</Badge>
        <h1 id="products-heading">{copy.products.title}</h1>
        <p>{copy.products.body}</p>
      </section>

      <div className="storefront-catalog-layout">
        <aside className="storefront-filter-panel" aria-labelledby="filter-heading">
          <h2 id="filter-heading">{copy.products.filter}</h2>
          <form>
            <label>
              <span>{copy.products.availability}</span>
              <select name="availability" defaultValue="">
                <option value="">{copy.products.all}</option>
                <option value="in_stock">{copy.products.inStock}</option>
                <option value="out_of_stock">{copy.products.outOfStock}</option>
              </select>
            </label>
            <label>
              <span>{copy.products.sort}</span>
              <select name="sort" defaultValue="featured">
                <option value="featured">{copy.products.sortOptions.featured}</option>
                <option value="price_asc">{copy.products.sortOptions.priceAsc}</option>
                <option value="price_desc">{copy.products.sortOptions.priceDesc}</option>
              </select>
            </label>
          </form>
        </aside>

        <section aria-label={copy.products.title}>
          <div className="storefront-product-grid">
            {products.map((product) => (
              <ProductCard key={product.id} copy={copy} product={product} />
            ))}
          </div>
          <Card className="storefront-pagination" padding="sm" role="navigation" aria-label={copy.products.pagination}>
            <span>{copy.products.pageStatus}</span>
            <button type="button" disabled>
              {copy.products.previous}
            </button>
            <button type="button">{copy.products.next}</button>
          </Card>
        </section>
      </div>
    </div>
  );
}
