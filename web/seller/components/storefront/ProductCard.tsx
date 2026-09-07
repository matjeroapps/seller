'use client';

import { Badge, Button, Card } from '@matjerhub/ui-sdk';
import { ShoppingBag } from 'lucide-react';

import type { StorefrontCopy, StorefrontProduct } from '@/lib/storefront/mock-data';

export function ProductCard({ copy, product }: { copy: StorefrontCopy; product: StorefrontProduct }) {
  return (
    <Card className="storefront-product-card" padding="none" hover>
      <div className="storefront-product-card__media" aria-label={product.imageLabel}>
        <span>{product.imageLabel}</span>
        {product.badge ? <Badge variant="default">{product.badge}</Badge> : null}
      </div>
      <div className="storefront-product-card__body">
        <div>
          <p className="storefront-product-card__category">{product.category}</p>
          <h3>{product.name}</h3>
        </div>
        <div className="storefront-product-card__meta">
          <strong>{product.price}</strong>
          <span data-available={product.available}>{product.available ? copy.products.inStock : copy.products.outOfStock}</span>
        </div>
        <Button type="button" variant="outline" size="sm" fullWidth leftIcon={<ShoppingBag aria-hidden="true" size={16} />}>
          {copy.products.details}
        </Button>
      </div>
    </Card>
  );
}
