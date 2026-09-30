import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ProductCard } from '../src/themes/matjero-default/components';
import { ProductDetail as DefaultProductDetail } from '../src/themes/matjero-default/pages';
import { ProductDetail as BoutiqueProductDetail } from '../src/themes/matjero-boutique/pages';
import { toProductCard, toProductDetailModel, toThemeContext } from '../src/lib/view-models';
import { categoriesA, productDetailA, productItemA, storeA } from './fixtures/storefront';
import { copyFor } from './support/render';

describe('Storefront Catalog & Media Rendering', () => {
  const context = toThemeContext({
    store: storeA,
    locale: 'en',
    availableLocales: ['en', 'ar'],
    categories: categoriesA,
    currentPath: '/products'
  });

  it('renders product cards with normalized /media/* proxy paths and alt text', () => {
    const rawItem = {
      ...productItemA,
      image: {
        uri: 'http://minio:9000/matjero-staging-media/products/aurora-lamp.png',
        alt_text: 'Aurora Lamp Studio Shot'
      }
    };
    const cardModel = toProductCard(rawItem, storeA.currency, 'en', copyFor('en'));

    expect(cardModel.image?.uri).toBe('/media/products/aurora-lamp.png');
    expect(cardModel.image?.alt).toBe('Aurora Lamp Studio Shot');

    render(<ProductCard product={cardModel} context={context} />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/media/products/aurora-lamp.png');
    expect(img).toHaveAttribute('alt', 'Aurora Lamp Studio Shot');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('renders out-of-stock badge on product card when availability is out_of_stock', () => {
    const rawItem = {
      ...productItemA,
      availability: 'out_of_stock' as const
    };
    const cardModel = toProductCard(rawItem, storeA.currency, 'en', copyFor('en'));
    expect(cardModel.available).toBe(false);

    render(<ProductCard product={cardModel} context={context} />);

    expect(screen.getByText('Out of stock')).toBeInTheDocument();
  });

  it('renders product detail gallery with primary image and thumbnails in Default theme', () => {
    const rawDetail = {
      ...productDetailA,
      images: [
        { uri: 'http://minio:9000/matjero-staging-media/products/lamp-1.jpg', alt_text: 'Main View' },
        { uri: 'http://minio:9000/matjero-staging-media/products/lamp-2.jpg', alt_text: 'Angle View' }
      ]
    };
    const detailModel = toProductDetailModel(rawDetail, storeA.currency, 'en', copyFor('en'));

    expect(detailModel.images[0].uri).toBe('/media/products/lamp-1.jpg');
    expect(detailModel.images[1].uri).toBe('/media/products/lamp-2.jpg');

    render(<DefaultProductDetail context={context} model={detailModel} />);

    expect(screen.getByAltText('Main View')).toHaveAttribute('src', '/media/products/lamp-1.jpg');
    expect(screen.getByAltText('Angle View')).toHaveAttribute('src', '/media/products/lamp-2.jpg');
  });

  it('renders product detail gallery with thumbnails in Boutique theme', () => {
    const rawDetail = {
      ...productDetailA,
      images: [
        { uri: 'http://minio:9000/matjero-staging-media/products/lamp-1.jpg', alt_text: 'Main View' },
        { uri: 'http://minio:9000/matjero-staging-media/products/lamp-2.jpg', alt_text: 'Angle View' }
      ]
    };
    const detailModel = toProductDetailModel(rawDetail, storeA.currency, 'en', copyFor('en'));

    render(<BoutiqueProductDetail context={context} model={detailModel} />);

    expect(screen.getByAltText('Main View')).toHaveAttribute('src', '/media/products/lamp-1.jpg');
    expect(screen.getByAltText('Angle View')).toHaveAttribute('src', '/media/products/lamp-2.jpg');
  });

  it('renders empty image placeholder safely when product has no images', () => {
    const rawDetail = {
      ...productDetailA,
      images: []
    };
    const detailModel = toProductDetailModel(rawDetail, storeA.currency, 'en', copyFor('en'));

    const { container } = render(<DefaultProductDetail context={context} model={detailModel} />);
    expect(container.querySelector('.product__image--empty')).toBeInTheDocument();
  });
});
