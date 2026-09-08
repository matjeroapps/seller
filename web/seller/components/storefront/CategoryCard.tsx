'use client';

import { Card } from '@matjerhub/ui-sdk';
import { ArrowUpRight } from 'lucide-react';

import type { StorefrontCategory, StorefrontCopy } from '@/lib/storefront/mock-data';

export function CategoryCard({ category, copy }: { category: StorefrontCategory; copy: StorefrontCopy }) {
  return (
    <Card className="storefront-category-card" padding="lg">
      <div>
        <h3>{category.name}</h3>
        <p>{copy.products.itemCount.replace('{count}', String(category.count))}</p>
      </div>
      <ArrowUpRight aria-hidden="true" size={20} />
    </Card>
  );
}
