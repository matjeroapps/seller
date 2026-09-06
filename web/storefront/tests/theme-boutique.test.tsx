import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { matjeroBoutiqueTheme } from '../src/themes/matjero-boutique';
import { themeRegistry } from '../src/themes';
import type { StoreBootstrap } from '../src/lib/contracts';
import { categoriesA, productDetailA, productPageA, storeA } from './fixtures/storefront';
import { detailModel, homeModel, listModel, searchModel } from './support/models';
import { buildContext, renderInDocument } from './support/render';

function storeOnBoutiqueTheme(): StoreBootstrap {
  return {
    ...storeA,
    theme: { ...storeA.theme!, key: 'matjero-boutique', version: '1.0.0' }
  };
}

describe('matjero-boutique theme', () => {
  it('is registered in themeRegistry alongside matjero-default', () => {
    expect(themeRegistry.keys()).toContain('matjero-boutique');
    expect(themeRegistry.keys()).toContain('matjero-default');

    const resolved = themeRegistry.resolve({ key: 'matjero-boutique', version: '1.0.0' });
    expect(resolved.outcome).toBe('resolved');
    if (resolved.outcome === 'resolved') {
      expect(resolved.theme.key).toBe('matjero-boutique');
    }
  });

  it('renders Layout with theme--boutique styling wrapper', () => {
    const store = storeOnBoutiqueTheme();
    const context = buildContext({ store, locale: 'en', categories: categoriesA });

    const { container } = renderInDocument(
      <matjeroBoutiqueTheme.components.Layout context={context}>
        <div data-testid="child-content">Boutique Content</div>
      </matjeroBoutiqueTheme.components.Layout>,
      'en'
    );

    expect(container.querySelector('.theme--boutique')).not.toBeNull();
    expect(screen.getByTestId('child-content')).toHaveTextContent('Boutique Content');
  });

  it('renders ProductList with boutique cards', () => {
    const store = storeOnBoutiqueTheme();
    const context = buildContext({ store, locale: 'en', categories: categoriesA });
    const model = listModel({ context, store, page: productPageA });

    const { Layout, ProductList } = matjeroBoutiqueTheme.components;
    renderInDocument(
      <Layout context={context}>
        <ProductList context={context} model={model} />
      </Layout>,
      'en'
    );

    expect(document.querySelector('.boutique-card')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 3, name: 'Aurora desk lamp' })).toBeInTheDocument();
    expect(screen.getByText(/249\.00/)).toBeInTheDocument();
  });

  it('renders ProductDetail with structured sections and purchase control anchor', () => {
    const store = storeOnBoutiqueTheme();
    const context = buildContext({ store, locale: 'en', categories: categoriesA });
    const model = detailModel({ context, store, product: productDetailA });

    const { Layout, ProductDetail } = matjeroBoutiqueTheme.components;
    renderInDocument(
      <Layout context={context}>
        <ProductDetail context={context} model={model} />
      </Layout>,
      'en'
    );

    expect(document.querySelector('.boutique-product')).not.toBeNull();
    expect(document.querySelector('#purchase-control')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Aurora desk lamp' })).toBeInTheDocument();
  });

  it('supports RTL Arabic rendering smoothly', () => {
    const store = storeOnBoutiqueTheme();
    const context = buildContext({ store, locale: 'ar', categories: categoriesA });
    const model = homeModel({ context, store, products: productPageA, categories: categoriesA });

    const { Layout, Home } = matjeroBoutiqueTheme.components;
    renderInDocument(
      <Layout context={context}>
        <Home context={context} model={model} />
      </Layout>,
      'ar'
    );

    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });
});
