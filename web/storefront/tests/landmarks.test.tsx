import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { matjeroDefaultTheme } from '../src/themes/matjero-default';
import { categoriesA, productDetailA, productPageA, storeA } from './fixtures/storefront';
import { categoryModel, detailModel, listModel } from './support/models';
import { buildContext, renderInDocument } from './support/render';

const { Layout, Category, ProductDetail, ProductList } = matjeroDefaultTheme.components;

describe('landmark naming', () => {
  it('gives every navigation landmark a distinct accessible name', () => {
    const context = buildContext({ store: storeA, locale: 'en', categories: categoriesA });

    renderInDocument(
      <Layout context={context}>
        <ProductList context={context} model={listModel({ context, store: storeA, page: productPageA })} />
      </Layout>,
      'en'
    );

    const names = screen.getAllByRole('navigation').map((nav) => nav.getAttribute('aria-label'));

    expect(names).toContain('Primary');
    expect(names).toContain('Language');
    // Two landmarks sharing a name are indistinguishable when navigating by landmark.
    expect(new Set(names).size).toBe(names.length);
  });

  it('names the breadcrumb separately from the primary navigation', () => {
    const context = buildContext({ store: storeA, locale: 'en', categories: categoriesA });

    renderInDocument(
      <Layout context={context}>
        <ProductDetail context={context} model={detailModel({ context, store: storeA, product: productDetailA })} />
      </Layout>,
      'en'
    );

    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    const names = screen.getAllByRole('navigation').map((nav) => nav.getAttribute('aria-label'));
    expect(new Set(names).size).toBe(names.length);
  });

  it('names landmarks in Arabic on an Arabic page', () => {
    const context = buildContext({ store: storeA, locale: 'ar', categories: categoriesA });

    renderInDocument(
      <Layout context={context}>
        <Category
          context={context}
          model={categoryModel({ context, store: storeA, category: categoriesA[0], page: productPageA })}
        />
      </Layout>,
      'ar'
    );

    expect(screen.getByRole('navigation', { name: 'مسار التنقل' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'التنقل الرئيسي' })).toBeInTheDocument();
    const names = screen.getAllByRole('navigation').map((nav) => nav.getAttribute('aria-label'));
    expect(new Set(names).size).toBe(names.length);
  });
});
