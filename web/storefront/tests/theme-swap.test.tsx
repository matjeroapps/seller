import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { ThemeRegistry } from '../src/themes/registry';
import { matjeroDefaultTheme } from '../src/themes/matjero-default';
import type { StoreBootstrap } from '../src/lib/contracts';
import { categoriesA, productDetailA, productPageA, storeA } from './fixtures/storefront';
import { detailModel, homeModel, listModel, searchModel } from './support/models';
import { buildContext, renderInDocument } from './support/render';
import { stubTheme } from './support/stub-theme';

/**
 * Swap-proof test.
 *
 * The registry, the theme context and every view model are built exactly as the server
 * builds them, then handed to two unrelated component sets. Nothing between the API and
 * the theme boundary is parameterized by theme — the same objects render twice — which is
 * what makes a theme swap a presentation change.
 */

/** The same store, pinned to the stub theme instead of the production one. */
function storeOnStubTheme(): StoreBootstrap {
  return {
    ...storeA,
    theme: { ...storeA.theme!, key: 'stub-theme', version: '1.0.0' }
  };
}

function registry(): ThemeRegistry {
  return new ThemeRegistry().register(matjeroDefaultTheme, { asDefault: true }).register(stubTheme);
}

describe('theme swap', () => {
  it('resolves either theme from the same store payload shape', () => {
    const themes = registry();

    expect(themes.resolve(storeA.theme)).toMatchObject({ outcome: 'resolved' });
    expect(themes.resolve(storeOnStubTheme().theme)).toMatchObject({ outcome: 'resolved' });

    const resolvedStub = themes.resolve(storeOnStubTheme().theme);
    expect(resolvedStub.outcome === 'resolved' && resolvedStub.theme.key).toBe('stub-theme');
  });

  it('renders the same product list model through both component sets', () => {
    const store = storeOnStubTheme();
    const context = buildContext({ store, locale: 'en', categories: categoriesA });
    // One model, built once, by the production mapping code.
    const model = listModel({ context, store, page: productPageA });

    const resolution = registry().resolve(store.theme);
    expect(resolution.outcome).toBe('resolved');
    const stub = resolution.outcome === 'resolved' ? resolution.theme : matjeroDefaultTheme;

    const first = renderInDocument(
      <stub.components.Layout context={context}>
        <stub.components.ProductList context={context} model={model} />
      </stub.components.Layout>,
      'en'
    );

    // The stub renders a table; the production theme renders a card grid.
    expect(screen.getByTestId('stub-products')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aurora desk lamp' })).toHaveAttribute(
      'href',
      '/en/products/aurora-desk-lamp'
    );
    expect(screen.getByText(/249\.00/)).toBeInTheDocument();
    expect(document.querySelector('.card')).toBeNull();
    first.unmount();

    const { Layout, ProductList } = matjeroDefaultTheme.components;
    renderInDocument(
      <Layout context={context}>
        <ProductList context={context} model={model} />
      </Layout>,
      'en'
    );

    expect(screen.queryByTestId('stub-products')).toBeNull();
    expect(document.querySelector('.card')).not.toBeNull();
    // Same data, same price, same link: only the markup changed.
    expect(screen.getByRole('heading', { level: 3, name: 'Aurora desk lamp' })).toBeInTheDocument();
    expect(screen.getByText(/249\.00/)).toBeInTheDocument();
  });

  it('renders every page kind through the stub theme with unchanged models', () => {
    const store = storeOnStubTheme();
    const context = buildContext({ store, locale: 'en', categories: categoriesA });
    const stub = stubTheme.components;

    const home = renderInDocument(
      <stub.Home context={context} model={homeModel({ context, store, products: productPageA, categories: categoriesA })} />,
      'en'
    );
    expect(screen.getByTestId('stub-heading')).toHaveTextContent('Everything for the modern home');
    expect(screen.getByTestId('stub-section-featured')).toHaveTextContent('Aurora desk lamp');
    home.unmount();

    const detail = renderInDocument(
      <stub.ProductDetail context={context} model={detailModel({ context, store, product: productDetailA })} />,
      'en'
    );
    expect(screen.getByTestId('stub-detail')).toHaveTextContent('In stock');
    detail.unmount();

    const search = renderInDocument(
      <stub.SearchResults context={context} model={searchModel({ context, store, page: productPageA, keyword: 'lamp' })} />,
      'en'
    );
    expect(screen.getByTestId('stub-heading')).toHaveTextContent('lamp');
    search.unmount();

    renderInDocument(<stub.NotFound context={context} />, 'en');
    expect(screen.getByTestId('stub-heading')).toHaveTextContent('Page not found');
  });

  it('passes localization and direction to the swapped theme unchanged', () => {
    const store = storeOnStubTheme();
    const context = buildContext({ store, locale: 'ar', categories: categoriesA });

    const { container } = renderInDocument(
      <stubTheme.components.Layout context={context}>
        <span />
      </stubTheme.components.Layout>,
      'ar'
    );

    const root = container.querySelector('[data-theme="stub-theme"]');
    expect(root).toHaveAttribute('data-locale', 'ar');
    expect(root).toHaveAttribute('data-direction', 'rtl');
    expect(screen.getByTestId('stub-brand')).toHaveTextContent('Store A');
  });

  it('refuses a store pinned to a version the stub theme does not declare', () => {
    const themes = registry();

    expect(themes.resolve({ key: 'stub-theme', version: '9.9.9' })).toEqual({
      outcome: 'unsupported_version',
      key: 'stub-theme',
      version: '9.9.9'
    });
  });
});
