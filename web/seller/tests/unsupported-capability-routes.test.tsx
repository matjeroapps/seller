import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { UnsupportedCapabilityScreen } from '../components/seller/UnsupportedCapabilityScreen';

const unsupportedRouteFiles = [
  'app/(dashboard)/dashboard/stores/[store_id]/analytics/page.tsx',
  'app/(dashboard)/dashboard/stores/[store_id]/billing/page.tsx',
  'app/(dashboard)/dashboard/stores/[store_id]/carts/page.tsx',
  'app/(dashboard)/dashboard/stores/[store_id]/customers/page.tsx',
  'app/(dashboard)/dashboard/stores/[store_id]/customers/new/page.tsx',
  'app/(dashboard)/dashboard/stores/[store_id]/finance/payouts/new/page.tsx',
  'app/(dashboard)/dashboard/stores/[store_id]/notifications/page.tsx',
  'app/(dashboard)/dashboard/stores/[store_id]/orders/new/page.tsx',
];

describe('Unsupported Seller Dashboard routes', () => {
  it('renders an explicit unavailable state with a useful next action', () => {
    render(
      <UnsupportedCapabilityScreen
        eyebrow="Orders"
        title="Manual order creation is not available yet"
        description="Draft/manual order creation is not currently supported by Core."
        storeId="str_1"
        primaryHref="/dashboard/stores/str_1/orders"
        primaryLabel="View store orders"
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Manual order creation is not available yet' })).toBeInTheDocument();
    expect(screen.getByText('Draft/manual order creation is not currently supported by Core.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View store orders' })).toHaveAttribute(
      'href',
      '/dashboard/stores/str_1/orders'
    );
    expect(screen.getByRole('link', { name: /Return to dashboard/i })).toHaveAttribute(
      'href',
      '/dashboard/stores/str_1'
    );
  });

  it('does not silently redirect direct-open deferred routes', () => {
    for (const routeFile of unsupportedRouteFiles) {
      const source = readFileSync(join(process.cwd(), routeFile), 'utf8');

      expect(source, routeFile).not.toContain("from 'next/navigation'");
      expect(source, routeFile).not.toContain('redirect(');
      expect(source, routeFile).toContain('UnsupportedCapabilityScreen');
    }
  });
});
