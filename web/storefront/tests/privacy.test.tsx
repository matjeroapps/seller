import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { matjeroDefaultTheme } from '../src/themes/matjero-default';
import { toProductDetailModel } from '../src/lib/view-models';
import {
  categoriesA,
  productDetailWithInternals,
  productItemWithInternals,
  storeA
} from './fixtures/storefront';
import { listModel } from './support/models';
import { buildContext, renderInDocument } from './support/render';

const { Layout, ProductDetail, ProductList } = matjeroDefaultTheme.components;

/**
 * Privacy tests.
 *
 * The fixtures carry fields the public API does not return — a wholesale price, a
 * supplier and its contact details, a platform fee, a margin, a fulfillment provider,
 * internal notes. They are present so these tests can prove the rendering path has no way
 * to surface such a field even if one appeared in a payload: the view models select
 * fields explicitly rather than spreading a payload into a component.
 *
 * The customer-facing price is the Seller listing price and nothing else.
 */

/** Values that must never reach rendered output. */
const FORBIDDEN = [
  '110.00',
  '11000',
  'Northwind',
  'northwind-supply',
  'ops@northwind-supply.example',
  '+20 100 000 0000',
  'b6f1a2c4-1111-2222-3333-444455556666',
  '2400',
  '11500',
  'internal-3pl-eu-1',
  'reorder from warehouse 7',
  'wholesale',
  'supplier',
  'platform_fee',
  'margin',
  'fulfillment'
];

function assertNoInternals(html: string, text: string) {
  for (const forbidden of FORBIDDEN) {
    expect(html.toLowerCase()).not.toContain(forbidden.toLowerCase());
    expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase());
  }
}

describe('supplier and cost privacy', () => {
  it('renders a product page with no internal field, even when the payload carries them', () => {
    const context = buildContext({ store: storeA, locale: 'en', categories: categoriesA });
    const model = toProductDetailModel(productDetailWithInternals, storeA.currency, 'en', context.copy);

    const { container } = renderInDocument(
      <Layout context={context}>
        <ProductDetail context={context} model={model} />
      </Layout>,
      'en'
    );

    // The public listing price is present.
    expect(screen.getByText(/249\.00/)).toBeInTheDocument();
    assertNoInternals(container.innerHTML, container.textContent ?? '');
  });

  it('renders a listing with no internal field', () => {
    const context = buildContext({ store: storeA, locale: 'en' });
    const model = listModel({
      context,
      store: storeA,
      page: { items: [productItemWithInternals], pagination: { total: 1, limit: 24, offset: 0 } }
    });

    const { container } = renderInDocument(<ProductList context={context} model={model} />, 'en');

    expect(screen.getByText(/249\.00/)).toBeInTheDocument();
    assertNoInternals(container.innerHTML, container.textContent ?? '');
  });

  it('drops internal fields at the view model boundary', () => {
    const context = buildContext({ store: storeA, locale: 'en' });
    const model = toProductDetailModel(productDetailWithInternals, storeA.currency, 'en', context.copy);

    const serialized = JSON.stringify(model).toLowerCase();
    for (const forbidden of FORBIDDEN) {
      expect(serialized).not.toContain(forbidden.toLowerCase());
    }
    // The public price survives, in minor units, exactly as Core reported it.
    expect(model.price.amountMinor).toBe(24900);
  });

  it('exposes the count of purchasable units, not their internal identifiers', () => {
    const context = buildContext({ store: storeA, locale: 'en' });
    const model = toProductDetailModel(productDetailWithInternals, storeA.currency, 'en', context.copy);

    expect(model.variants[0]).toMatchObject({ code: 'brass', available: true, skuCount: 1 });
    expect(JSON.stringify(model)).not.toContain('sku-aurora-brass');

    const { container } = renderInDocument(<ProductDetail context={context} model={model} />, 'en');
    expect(container.innerHTML).not.toContain('sku-aurora-brass');
  });

  it('renders no internal transport detail when a request fails', () => {
    const { ErrorState } = matjeroDefaultTheme.components;
    const context = buildContext({ store: storeA, locale: 'en' });

    const { container } = renderInDocument(<ErrorState locale="en" copy={context.copy} />, 'en');

    const html = container.innerHTML.toLowerCase();
    for (const forbidden of ['storefront-api', 'core-api', 'localhost', '127.0.0.1', 'econnrefused', 'bearer', 'stack']) {
      expect(html).not.toContain(forbidden);
    }
    expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeInTheDocument();
  });

  it('renders no reason on the unavailable page', () => {
    const { Unavailable } = matjeroDefaultTheme.components;
    const context = buildContext({ store: storeA, locale: 'en' });

    const { container } = renderInDocument(<Unavailable locale="en" copy={context.copy} />, 'en');

    const html = container.innerHTML.toLowerCase();
    for (const forbidden of [
      'suspended',
      'inactive',
      'moderation',
      'seller',
      'store-a',
      'theme',
      'database',
      'core'
    ]) {
      expect(html).not.toContain(forbidden);
    }
  });
});
