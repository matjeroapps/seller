import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';

import { matjeroDefaultTheme } from '../src/themes/matjero-default';
import {
  categoriesA,
  categoriesB,
  productDetailA,
  productDetailB,
  productPageA,
  productPageB,
  storeA,
  storeB
} from './fixtures/storefront';
import { categoryModel, detailModel, emptyPage, homeModel, listModel, searchModel } from './support/models';
import { buildContext, renderInDocument } from './support/render';

const { Layout, Home, ProductList, ProductDetail, Category, SearchResults, NotFound, Unavailable } =
  matjeroDefaultTheme.components;

describe('home page', () => {
  it('renders the configured hero and sections', () => {
    const context = buildContext({ store: storeA, locale: 'en', categories: categoriesA });
    const model = homeModel({ context, store: storeA, products: productPageA, categories: categoriesA });

    renderInDocument(
      <Layout context={context}>
        <Home context={context} model={model} />
      </Layout>,
      'en'
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Everything for the modern home' })).toBeInTheDocument();
    expect(screen.getByText('Curated lighting, furniture and decor.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shop lighting' })).toHaveAttribute(
      'href',
      'https://store-a.example/en/categories/lighting'
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Featured' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Browse categories' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Aurora desk lamp' })).toBeInTheDocument();
  });

  it('shows the announcement bar only when the store enabled one', () => {
    const withBar = buildContext({ store: storeA, locale: 'en' });
    renderInDocument(
      <Layout context={withBar}>
        <span />
      </Layout>,
      'en'
    ).unmount();

    const withoutBar = buildContext({ store: storeB, locale: 'en' });
    const { container } = renderInDocument(
      <Layout context={withoutBar}>
        <span />
      </Layout>,
      'en'
    );

    expect(container.querySelector('.announcement')).toBeNull();
  });

  it('falls back to the store name when no hero is published', () => {
    const context = buildContext({ store: storeB, locale: 'en' });
    const model = homeModel({ context, store: storeB, products: productPageB });

    renderInDocument(<Home context={context} model={model} />, 'en');

    expect(screen.getByRole('heading', { level: 1, name: 'Store B' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shop now' })).toHaveAttribute('href', '/en/products');
  });

  it('omits a section that has nothing to show', () => {
    const context = buildContext({ store: storeA, locale: 'en' });
    const model = homeModel({ context, store: storeA, products: emptyPage(), categories: [] });

    renderInDocument(<Home context={context} model={model} />, 'en');

    expect(screen.queryByRole('heading', { level: 2, name: 'Featured' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: 'Browse categories' })).toBeNull();
  });
});

describe('product listing', () => {
  it('renders each product with its public price and availability', () => {
    const context = buildContext({ store: storeA, locale: 'en' });
    const model = listModel({ context, store: storeA, page: productPageA });

    const { container } = renderInDocument(<ProductList context={context} model={model} />, 'en');

    expect(screen.getByRole('heading', { level: 1, name: 'Products' })).toBeInTheDocument();
    expect(screen.getByText('2 products')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Aurora desk lamp' })).toBeInTheDocument();
    expect(screen.getByText(/249\.00/)).toBeInTheDocument();

    // Scoped to the grid: the refine form also has an "Out of stock" filter option.
    const grid = within(container.querySelector('.grid') as HTMLElement);
    expect(grid.getByText('In stock')).toBeInTheDocument();
    expect(grid.getByText('Out of stock')).toBeInTheDocument();
  });

  it('exposes filter and sort as a URL-driven form', () => {
    const context = buildContext({ store: storeA, locale: 'en' });
    const model = listModel({ context, store: storeA, page: productPageA, search: { sort: 'price_asc' } });

    const { container } = renderInDocument(<ProductList context={context} model={model} />, 'en');

    const form = container.querySelector('form.refine') as HTMLFormElement;
    expect(form).toHaveAttribute('action', '/en/products');
    expect(form).toHaveAttribute('method', 'get');
    expect(screen.getByLabelText('Sort by')).toHaveValue('price_asc');
    expect(screen.getByLabelText('Availability')).toHaveValue('');
  });

  it('renders pagination links only when there is more than one page', () => {
    const context = buildContext({ store: storeA, locale: 'en' });

    const single = listModel({ context, store: storeA, page: productPageA });
    const { container, unmount } = renderInDocument(<ProductList context={context} model={single} />, 'en');
    expect(container.querySelector('.pager')).toBeNull();
    unmount();

    const paged = listModel({
      context,
      store: storeA,
      page: { items: productPageA.items, pagination: { total: 60, limit: 24, offset: 24 } },
      search: { page: '2' }
    });
    renderInDocument(<ProductList context={context} model={paged} />, 'en');

    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/en/products');
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/en/products?page=3');
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('renders a localized empty state for a catalog with no products', () => {
    const context = buildContext({ store: storeA, locale: 'en' });
    const model = listModel({ context, store: storeA, page: emptyPage() });

    renderInDocument(<ProductList context={context} model={model} />, 'en');

    expect(screen.getByRole('status')).toHaveTextContent('No products yet');
  });
});

describe('category page', () => {
  it('renders the category, its parent and its products', () => {
    const context = buildContext({ store: storeA, locale: 'en', categories: categoriesA });
    const model = categoryModel({
      context,
      store: storeA,
      category: categoriesA[1],
      parent: categoriesA[0],
      page: productPageA
    });

    renderInDocument(<Category context={context} model={model} />, 'en');

    expect(screen.getByRole('heading', { level: 1, name: 'Desk lamps' })).toBeInTheDocument();
    expect(screen.getByText('Part of Lighting')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Aurora desk lamp' })).toBeInTheDocument();
  });

  it('paginates within the category path', () => {
    const context = buildContext({ store: storeA, locale: 'en' });
    const model = categoryModel({
      context,
      store: storeA,
      category: categoriesA[0],
      page: { items: productPageA.items, pagination: { total: 50, limit: 24, offset: 0 } }
    });

    renderInDocument(<Category context={context} model={model} />, 'en');

    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute(
      'href',
      '/en/categories/lighting?page=2'
    );
  });

  it('renders a category-specific empty state', () => {
    const context = buildContext({ store: storeA, locale: 'en' });
    const model = categoryModel({ context, store: storeA, category: categoriesA[0], page: emptyPage() });

    renderInDocument(<Category context={context} model={model} />, 'en');

    expect(screen.getByRole('status')).toHaveTextContent('This category has no products yet');
  });
});

describe('product detail', () => {
  it('renders the public fields of a product', () => {
    const context = buildContext({ store: storeA, locale: 'en' });
    const model = detailModel({ context, store: storeA, product: productDetailA });

    renderInDocument(<ProductDetail context={context} model={model} />, 'en');

    expect(screen.getByRole('heading', { level: 1, name: 'Aurora desk lamp' })).toBeInTheDocument();
    expect(screen.getByText(/A warm, dimmable desk lamp with a brushed brass finish\./)).toBeInTheDocument();
    expect(screen.getByText(/249\.00/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Options' })).toBeInTheDocument();
    expect(screen.getByText('brass')).toBeInTheDocument();
    expect(screen.getByText('graphite')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Lighting' })).toHaveAttribute('href', '/en/categories/lighting');
  });

  it('renders the gallery with meaningful alt text', () => {
    const context = buildContext({ store: storeA, locale: 'en' });
    const model = detailModel({ context, store: storeA, product: productDetailA });

    renderInDocument(<ProductDetail context={context} model={model} />, 'en');

    expect(screen.getByAltText('Aurora desk lamp on a desk')).toBeInTheDocument();
    // The second image has no alt text upstream, so the product name is used.
    expect(screen.getAllByAltText('Aurora desk lamp')).toHaveLength(1);
  });

  it('labels a product with no media instead of rendering a broken image', () => {
    const context = buildContext({ store: storeB, locale: 'en' });
    const model = detailModel({ context, store: storeB, product: productDetailB });

    renderInDocument(<ProductDetail context={context} model={model} />, 'en');

    expect(screen.getByRole('img', { name: 'No image available' })).toBeInTheDocument();
  });
});

describe('search', () => {
  it('renders results for a keyword', () => {
    const context = buildContext({ store: storeA, locale: 'en' });
    const model = searchModel({ context, store: storeA, page: productPageA, keyword: 'lamp' });

    renderInDocument(<SearchResults context={context} model={model} />, 'en');

    expect(screen.getByRole('heading', { level: 1, name: 'Results for “lamp”' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Aurora desk lamp' })).toBeInTheDocument();
  });

  it('prompts for a keyword before any search is made', () => {
    const context = buildContext({ store: storeA, locale: 'en' });
    const model = searchModel({ context, store: storeA, page: emptyPage(), keyword: '' });

    renderInDocument(<SearchResults context={context} model={model} />, 'en');

    expect(screen.getByRole('heading', { level: 1, name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Enter a word to search this store.');
  });

  it('reports no results for a keyword that matched nothing', () => {
    const context = buildContext({ store: storeA, locale: 'en' });
    const model = searchModel({ context, store: storeA, page: emptyPage(), keyword: 'zzzz' });

    renderInDocument(<SearchResults context={context} model={model} />, 'en');

    expect(screen.getByRole('status')).toHaveTextContent('No results found');
  });

  it('submits the search form to the localized search path', () => {
    const context = buildContext({ store: storeA, locale: 'ar' });
    const model = searchModel({ context, store: storeA, page: emptyPage(), keyword: 'مصباح' });

    const { container } = renderInDocument(<SearchResults context={context} model={model} />, 'ar');

    const form = container.querySelector('form.search--page') as HTMLFormElement;
    expect(form).toHaveAttribute('action', '/ar/search');
    expect(form).toHaveAttribute('method', 'get');
    expect(screen.getByLabelText('ابحث في المنتجات')).toHaveValue('مصباح');
  });
});

describe('failure states', () => {
  it('renders the storefront 404 with chrome intact', () => {
    const context = buildContext({ store: storeA, locale: 'en', categories: categoriesA });

    renderInDocument(
      <Layout context={context}>
        <NotFound context={context} />
      </Layout>,
      'en'
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/en');
    // Store chrome is still present, so the customer can keep browsing.
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('renders the unavailable state without chrome or any reason', () => {
    const { container } = renderInDocument(<Unavailable locale="en" copy={buildContext({ store: storeA, locale: 'en' }).copy} />, 'en');

    expect(screen.getByRole('heading', { level: 1, name: 'Store unavailable' })).toBeInTheDocument();
    expect(screen.getByText('This store is not available right now.')).toBeInTheDocument();
    expect(container.querySelector('header')).toBeNull();
    expect(container.querySelector('footer')).toBeNull();
  });
});

describe('store isolation', () => {
  it('renders each store from its own data with no shared state', () => {
    const contextA = buildContext({ store: storeA, locale: 'en', categories: categoriesA });
    const contextB = buildContext({ store: storeB, locale: 'en', categories: categoriesB });

    const first = renderInDocument(
      <Layout context={contextA}>
        <ProductList context={contextA} model={listModel({ context: contextA, store: storeA, page: productPageA })} />
      </Layout>,
      'en'
    );

    const bannerA = within(screen.getByRole('banner'));
    expect(bannerA.getByText('Store A')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Aurora desk lamp' })).toBeInTheDocument();
    expect(screen.queryByText('Patio bench')).toBeNull();
    expect(screen.queryByText('Store B')).toBeNull();
    first.unmount();

    renderInDocument(
      <Layout context={contextB}>
        <ProductList context={contextB} model={listModel({ context: contextB, store: storeB, page: productPageB })} />
      </Layout>,
      'en'
    );

    const bannerB = within(screen.getByRole('banner'));
    expect(bannerB.getByText('Store B')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Patio bench' })).toBeInTheDocument();
    expect(screen.queryByText('Aurora desk lamp')).toBeNull();
    expect(screen.queryByText('Store A')).toBeNull();
    expect(screen.queryByText('Free delivery over 500')).toBeNull();
  });

  it('applies the theme configuration each store published', () => {
    const contextA = buildContext({ store: storeA, locale: 'en', categories: categoriesA });
    const contextB = buildContext({ store: storeB, locale: 'en', categories: categoriesB });

    expect(contextA.settings.tokens.colorPrimary).toBe('#0f766e');
    expect(contextA.settings.showSearch).toBe(true);
    expect(contextA.settings.footerColumns).toBe(3);

    expect(contextB.settings.tokens.colorPrimary).toBe('#7c3aed');
    expect(contextB.settings.showSearch).toBe(false);
    expect(contextB.settings.footerColumns).toBe(1);
    expect(contextB.settings.tokens.spacing).toBe('compact');
  });

  it('renders each store currency without leaking the other', () => {
    const contextA = buildContext({ store: storeA, locale: 'en' });
    const contextB = buildContext({ store: storeB, locale: 'en' });

    const first = renderInDocument(
      <ProductList context={contextA} model={listModel({ context: contextA, store: storeA, page: productPageA })} />,
      'en'
    );
    expect(screen.getAllByText(/EGP|E£/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/SAR|SR/)).toBeNull();
    first.unmount();

    renderInDocument(
      <ProductList context={contextB} model={listModel({ context: contextB, store: storeB, page: productPageB })} />,
      'en'
    );
    expect(screen.getAllByText(/SAR|SR/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/EGP|E£/)).toBeNull();
  });
});
