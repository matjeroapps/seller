'use client';

import { Card } from '@matjerhub/ui-sdk';
import { ArrowRight, Search } from 'lucide-react';
import Link from 'next/link';

import type { StorefrontData, StorefrontLocale } from '@/lib/storefront/mock-data';
import { CategoryCard } from './CategoryCard';
import { ProductCard } from './ProductCard';

export function StorefrontHome({ storefront, locale }: { storefront: StorefrontData; locale: StorefrontLocale }) {
  const copy = storefront.copy[locale];
  const basePath = `/store/${storefront.slug}`;
  const products = storefront.products[locale].slice(0, 4);

  return (
    <>
      <section className="storefront-hero" aria-labelledby="storefront-hero-title">
        <div className="storefront-hero__content">
          <p>{copy.home.eyebrow}</p>
          <h1 id="storefront-hero-title">{copy.home.title}</h1>
          <span>{copy.home.body}</span>
          <div className="storefront-hero__actions">
            <Link className="storefront-cta storefront-cta--primary" href={`${basePath}/products?lang=${locale}`}>
              {copy.home.cta}
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <Link className="storefront-cta storefront-cta--secondary" href={`${basePath}/search?lang=${locale}`}>
              <Search aria-hidden="true" size={18} />
              {copy.home.secondary}
            </Link>
          </div>
        </div>
        <div className="storefront-hero__panel" aria-label={copy.home.featured}>
          {products.slice(0, 2).map((product) => (
            <div key={product.id}>
              <span>{product.category}</span>
              <strong>{product.name}</strong>
              <p>{product.price}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="storefront-section" aria-labelledby="featured-products">
        <div className="storefront-section__header">
          <h2 id="featured-products">{copy.home.featured}</h2>
          <Link href={`${basePath}/products?lang=${locale}`}>{copy.home.cta}</Link>
        </div>
        <div className="storefront-product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} copy={copy} product={product} />
          ))}
        </div>
      </section>

      <section className="storefront-section" aria-labelledby="storefront-categories">
        <div className="storefront-section__header">
          <h2 id="storefront-categories">{copy.home.categories}</h2>
        </div>
        <div className="storefront-category-grid">
          {storefront.categories[locale].map((category) => (
            <CategoryCard key={category.id} category={category} copy={copy} />
          ))}
        </div>
      </section>

      <section className="storefront-section" aria-labelledby="storefront-promotions">
        <Card className="storefront-promotion" padding="lg">
          <div>
            <p>{copy.home.promotions}</p>
            <h2 id="storefront-promotions">{copy.home.promotionTitle}</h2>
            <span>{copy.home.promotionBody}</span>
          </div>
          <strong>{storefront.promotionCode}</strong>
        </Card>
      </section>
    </>
  );
}
