import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';

import { matjeroDefaultTheme } from '../src/themes/matjero-default';
import { categoriesA, productDetailA, productPageA, storeA } from './fixtures/storefront';
import { detailModel, homeModel, listModel, searchModel } from './support/models';
import { buildContext, renderInDocument } from './support/render';

const { Layout, Home, ProductDetail, ProductList, SearchResults } = matjeroDefaultTheme.components;

/**
 * Accessibility baseline.
 *
 * These assert the structural properties assistive technology depends on: real landmarks,
 * one `h1` per page, a descending heading order, labelled controls, meaningful alt text and
 * keyboard-reachable interaction. They are not a WCAG conformance claim.
 */

function headingLevels(container: HTMLElement): number[] {
  return [...container.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((heading) =>
    Number(heading.tagName.slice(1))
  );
}

describe('landmarks', () => {
  it('provides banner, navigation, main and contentinfo landmarks', () => {
    const context = buildContext({ store: storeA, locale: 'en', categories: categoriesA });

    renderInDocument(
      <Layout context={context}>
        <ProductList context={context} model={listModel({ context, store: storeA, page: productPageA })} />
      </Layout>,
      'en'
    );

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0);
  });

  it('offers a skip link that targets the main landmark', () => {
    const context = buildContext({ store: storeA, locale: 'en' });

    const { container } = renderInDocument(
      <Layout context={context}>
        <span />
      </Layout>,
      'en'
    );

    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveAttribute('href', '#main');
    expect(container.querySelector('#main')).toBe(screen.getByRole('main'));
  });

  it('names every navigation landmark', () => {
    const context = buildContext({ store: storeA, locale: 'en', categories: categoriesA });

    renderInDocument(
      <Layout context={context}>
        <span />
      </Layout>,
      'en'
    );

    for (const navigation of screen.getAllByRole('navigation')) {
      const label = navigation.getAttribute('aria-label');
      expect(label, 'every navigation landmark needs an accessible name').toBeTruthy();
    }
  });
});

describe('heading hierarchy', () => {
  it('gives each page exactly one h1', () => {
    const context = buildContext({ store: storeA, locale: 'en', categories: categoriesA });

    const pages = [
      <Home context={context} model={homeModel({ context, store: storeA, products: productPageA, categories: categoriesA })} />,
      <ProductList context={context} model={listModel({ context, store: storeA, page: productPageA })} />,
      <ProductDetail context={context} model={detailModel({ context, store: storeA, product: productDetailA })} />,
      <SearchResults context={context} model={searchModel({ context, store: storeA, page: productPageA, keyword: 'lamp' })} />
    ];

    for (const page of pages) {
      const view = renderInDocument(
        <Layout context={context}>{page}</Layout>,
        'en'
      );
      expect(view.container.querySelectorAll('h1')).toHaveLength(1);
      view.unmount();
    }
  });

  it('never skips a heading level', () => {
    const context = buildContext({ store: storeA, locale: 'en', categories: categoriesA });

    const { container } = renderInDocument(
      <Layout context={context}>
        <Home context={context} model={homeModel({ context, store: storeA, products: productPageA, categories: categoriesA })} />
      </Layout>,
      'en'
    );

    const levels = headingLevels(container);
    expect(levels.length).toBeGreaterThan(2);
    for (let index = 1; index < levels.length; index += 1) {
      expect(levels[index] - levels[index - 1]).toBeLessThanOrEqual(1);
    }
  });
});

describe('controls', () => {
  it('labels the search input and gives the form a search role', () => {
    const context = buildContext({ store: storeA, locale: 'en' });

    renderInDocument(
      <Layout context={context}>
        <span />
      </Layout>,
      'en'
    );

    const searches = screen.getAllByRole('search');
    expect(searches.length).toBeGreaterThan(0);
    const input = within(searches[0]).getByLabelText('Search products');
    expect(input).toHaveAttribute('name', 'q');
    expect(input.tagName).toBe('INPUT');
  });

  it('labels every filter control', () => {
    const context = buildContext({ store: storeA, locale: 'en' });
    const model = listModel({ context, store: storeA, page: productPageA });

    const { container } = renderInDocument(<ProductList context={context} model={model} />, 'en');

    for (const select of container.querySelectorAll('select')) {
      const id = select.getAttribute('id');
      expect(id).toBeTruthy();
      expect(container.querySelector(`label[for="${id}"]`)).not.toBeNull();
    }
    expect(screen.getByLabelText('Sort by')).toBeInTheDocument();
    expect(screen.getByLabelText('Availability')).toBeInTheDocument();
  });

  it('uses a real button for form submission', () => {
    const context = buildContext({ store: storeA, locale: 'en' });
    const model = listModel({ context, store: storeA, page: productPageA });

    renderInDocument(<ProductList context={context} model={model} />, 'en');

    expect(screen.getByRole('button', { name: 'Apply' })).toHaveAttribute('type', 'submit');
  });

  it('keeps the mobile menu keyboard-operable without JavaScript', () => {
    const context = buildContext({ store: storeA, locale: 'en', categories: categoriesA });

    const { container } = renderInDocument(
      <Layout context={context}>
        <span />
      </Layout>,
      'en'
    );

    // A <details>/<summary> pair is focusable and operable by keyboard natively.
    const details = container.querySelector('details.menu');
    expect(details).not.toBeNull();
    expect(details?.querySelector('summary')).not.toBeNull();
  });

  it('uses links, not buttons, for navigation', () => {
    const context = buildContext({ store: storeA, locale: 'en', categories: categoriesA });
    const model = listModel({
      context,
      store: storeA,
      page: { items: productPageA.items, pagination: { total: 60, limit: 24, offset: 24 } },
      search: { page: '2' }
    });

    renderInDocument(<ProductList context={context} model={model} />, 'en');

    expect(screen.getByRole('link', { name: 'Next' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });
});

describe('images', () => {
  it('gives every content image meaningful alt text', () => {
    const context = buildContext({ store: storeA, locale: 'en' });
    const model = listModel({ context, store: storeA, page: productPageA });

    const { container } = renderInDocument(<ProductList context={context} model={model} />, 'en');

    const images = [...container.querySelectorAll('img')];
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image.getAttribute('alt')).toBeTruthy();
    }
  });

  it('hides the decorative hero image from assistive technology', () => {
    const context = buildContext({ store: storeA, locale: 'en' });
    const model = homeModel({ context, store: storeA, products: productPageA });

    const { container } = renderInDocument(<Home context={context} model={model} />, 'en');

    const hero = container.querySelector('.hero__image') as HTMLImageElement;
    expect(hero).not.toBeNull();
    // Decorative: an empty alt plus aria-hidden keeps it out of the accessibility tree.
    expect(hero.getAttribute('alt')).toBe('');
    expect(hero).toHaveAttribute('aria-hidden', 'true');
  });

  it('labels a product with no media instead of leaving an unlabelled region', () => {
    const context = buildContext({ store: storeA, locale: 'en' });
    const model = detailModel({
      context,
      store: storeA,
      product: { ...productDetailA, images: [] }
    });

    renderInDocument(<ProductDetail context={context} model={model} />, 'en');

    expect(screen.getByRole('img', { name: 'No image available' })).toBeInTheDocument();
  });

  it('announces the current locale on the locale switch', () => {
    const context = buildContext({ store: storeA, locale: 'en', currentPath: '/products' });

    renderInDocument(
      <Layout context={context}>
        <span />
      </Layout>,
      'en'
    );

    const current = screen.getAllByRole('link', { name: 'English' })[0];
    expect(current).toHaveAttribute('aria-current', 'true');
    expect(current).toHaveAttribute('lang', 'en');
    expect(screen.getAllByRole('link', { name: 'العربية' })[0]).toHaveAttribute('lang', 'ar');
  });
});
