import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { matjeroDefaultTheme } from '../src/themes/matjero-default';
import { matjeroBoutiqueTheme } from '../src/themes/matjero-boutique';
import { categoriesA, productDetailA, productPageA, storeA } from './fixtures/storefront';
import { detailModel, homeModel, listModel, searchModel } from './support/models';
import { buildContext, renderInDocument } from './support/render';

describe('Multi-Theme & Localization Parity (Default vs Boutique)', () => {
  const defaultComponents = matjeroDefaultTheme.components;
  const boutiqueComponents = matjeroBoutiqueTheme.components;

  it('renders home page in both themes in English (LTR) with identical product counts and hero', () => {
    const enContext = buildContext({ store: storeA, locale: 'en', categories: categoriesA });
    const model = homeModel({ context: enContext, store: storeA, products: productPageA, categories: categoriesA });

    // 1. Default Theme
    const defView = renderInDocument(<defaultComponents.Home context={enContext} model={model} />, 'en');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Everything for the modern home');
    expect(screen.getByText('Aurora desk lamp')).toBeInTheDocument();
    defView.unmount();

    // 2. Boutique Theme
    renderInDocument(<boutiqueComponents.Home context={enContext} model={model} />, 'en');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Everything for the modern home');
    expect(screen.getByText('Aurora desk lamp')).toBeInTheDocument();
  });

  it('renders home page in both themes in Arabic (RTL) with proper direction and localized strings', () => {
    const arContext = buildContext({ store: storeA, locale: 'ar', categories: categoriesA });
    const model = homeModel({ context: arContext, store: storeA, products: productPageA, categories: categoriesA });

    // 1. Default Theme
    const defView = renderInDocument(<defaultComponents.Home context={arContext} model={model} />, 'ar');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Everything for the modern home');
    expect(screen.getByText('Aurora desk lamp')).toBeInTheDocument();
    expect(arContext.direction).toBe('rtl');
    defView.unmount();

    // 2. Boutique Theme
    const boutView = renderInDocument(<boutiqueComponents.Home context={arContext} model={model} />, 'ar');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Everything for the modern home');
    expect(screen.getByText('Aurora desk lamp')).toBeInTheDocument();
    expect(arContext.direction).toBe('rtl');
    boutView.unmount();
  });

  it('renders product detail page with price and purchase action in both themes', () => {
    const enContext = buildContext({ store: storeA, locale: 'en', categories: categoriesA });
    const model = detailModel({ context: enContext, store: storeA, product: productDetailA });

    // Default Theme
    const defView = renderInDocument(<defaultComponents.ProductDetail context={enContext} model={model} />, 'en');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Aurora desk lamp');
    expect(screen.getByText(/249\.00/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeInTheDocument();
    defView.unmount();

    // Boutique Theme
    const boutView = renderInDocument(<boutiqueComponents.ProductDetail context={enContext} model={model} />, 'en');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Aurora desk lamp');
    expect(screen.getByText(/249\.00/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeInTheDocument();
    boutView.unmount();
  });

  it('renders search results in both themes with keyword heading', () => {
    const enContext = buildContext({ store: storeA, locale: 'en', categories: categoriesA });
    const model = searchModel({ context: enContext, store: storeA, page: productPageA, keyword: 'lamp' });

    // Default Theme
    const defView = renderInDocument(<defaultComponents.SearchResults context={enContext} model={model} />, 'en');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('lamp');
    defView.unmount();

    // Boutique Theme
    const boutView = renderInDocument(<boutiqueComponents.SearchResults context={enContext} model={model} />, 'en');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('lamp');
    boutView.unmount();
  });
});
