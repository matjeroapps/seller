import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';

import { matjeroDefaultTheme } from '../src/themes/matjero-default';
import { productDetailA, storeA } from './fixtures/storefront';
import { detailModel } from './support/models';
import { buildContext, renderInDocument } from './support/render';
import type { ProductDetail } from '../src/lib/contracts';

const { Layout, ProductDetail } = matjeroDefaultTheme.components;

/**
 * Structured product page sections.
 *
 * The public contract serves sections already locale-projected — `content`
 * carries the display strings directly, with no `en`/`ar` envelope — so every
 * fixture below mirrors that projection exactly. The tests pin what the theme
 * renders for each section type and, just as importantly, what it refuses to
 * render (raw JSON, object dumps, disabled and unknown types).
 */

/**
 * A product whose six authored sections arrive in their projected public shape.
 *
 * Core's public projection omits `enabled` (it serves only enabled sections and
 * carries no per-locale envelope), which the fixtures below mirror exactly; a
 * disabled section is still covered to pin the theme's own defensive skip.
 */
const projectedProduct: ProductDetail = {
  ...productDetailA,
  sections: [
    {
      id: 'sec-description',
      type: 'description',
      sort_order: 1,
      content: { heading: 'About the lamp', body: 'Hand-assembled with a brushed brass finish.' }
    },
    {
      id: 'sec-highlights',
      type: 'highlights',
      sort_order: 2,
      content: { title: 'Why you will love it', items: ['Dimmable warmth', 'Two-year warranty'] }
    },
    {
      id: 'sec-image-text',
      type: 'image_text',
      sort_order: 3,
      content: {
        layout: 'right',
        image: { uri: 'https://cdn.example/aurora-lifestyle.jpg', alt_text: 'Lamp on a styled desk' },
        heading: 'Designed to be lived with',
        body: 'A warm glow for late work and slow mornings.'
      }
    },
    {
      id: 'sec-specifications',
      type: 'specifications',
      sort_order: 4,
      content: {
        items: [
          { key: 'Material', value: 'Brushed brass' },
          { key: 'Bulb', value: 'E27, 800 lm' }
        ]
      }
    },
    {
      id: 'sec-faq',
      type: 'faq',
      sort_order: 5,
      content: {
        items: [{ question: 'Does it dim?', answer: 'Yes, down to candle light.' }]
      }
    },
    {
      id: 'sec-final-cta',
      type: 'final_cta',
      sort_order: 6,
      content: {
        action: 'add_to_cart',
        title: 'Bring one home',
        body: 'Free returns within 30 days.'
      }
    },
    {
      id: 'sec-disabled',
      type: 'description',
      enabled: false,
      sort_order: 7,
      content: { heading: 'Disabled heading', body: 'Disabled body' }
    },
    {
      id: 'sec-unknown',
      type: 'video_embed',
      sort_order: 8,
      content: { url: 'https://cdn.example/clip.mp4', title: 'Watch the film' }
    }
  ]
};

function renderProjectedProduct(locale: 'en' | 'ar' = 'en') {
  const context = buildContext({ store: storeA, locale });
  const model = detailModel({ context, store: storeA, product: projectedProduct });
  return renderInDocument(
    <Layout context={context}>
      <ProductDetail context={context} model={model} />
    </Layout>,
    locale
  );
}

describe('product page sections', () => {
  it('renders the description heading and body', () => {
    renderProjectedProduct();

    expect(screen.getByRole('heading', { level: 2, name: 'About the lamp' })).toBeInTheDocument();
    expect(screen.getByText('Hand-assembled with a brushed brass finish.')).toBeInTheDocument();
  });

  it('renders the highlights title and list items', () => {
    renderProjectedProduct();

    expect(screen.getByRole('heading', { level: 2, name: 'Why you will love it' })).toBeInTheDocument();
    const highlightList = screen
      .getAllByRole('list')
      .find((candidate) => within(candidate).queryByText('Dimmable warmth') !== null);
    expect(highlightList).toBeDefined();
    const items = within(highlightList!).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Dimmable warmth');
    expect(items[1]).toHaveTextContent('Two-year warranty');
  });

  it('renders image_text with the projected image, copy and layout class', () => {
    const { container } = renderProjectedProduct();

    const imageText = container.querySelector('.product-page-section--image_text');
    expect(imageText).not.toBeNull();

    const image = within(imageText as HTMLElement).getByRole('img');
    expect(image).toHaveAttribute('src', 'https://cdn.example/aurora-lifestyle.jpg');
    expect(image).toHaveAttribute('alt', 'Lamp on a styled desk');
    expect(screen.getByRole('heading', { level: 2, name: 'Designed to be lived with' })).toBeInTheDocument();
    expect(screen.getByText('A warm glow for late work and slow mornings.')).toBeInTheDocument();

    const layout = imageText!.querySelector('.product-page-section__image-text');
    expect(layout).toHaveClass('product-page-section__image-text--right');
  });

  it('renders specifications as key/value rows', () => {
    const { container } = renderProjectedProduct();

    const specs = container.querySelector('.product-page-section--specifications');
    expect(specs).not.toBeNull();
    expect(within(specs as HTMLElement).getByText('Material')).toBeInTheDocument();
    expect(within(specs as HTMLElement).getByText('Brushed brass')).toBeInTheDocument();
    expect(within(specs as HTMLElement).getByText('Bulb')).toBeInTheDocument();
    expect(within(specs as HTMLElement).getByText('E27, 800 lm')).toBeInTheDocument();
  });

  it('renders the faq questions and answers', () => {
    renderProjectedProduct();

    expect(screen.getByRole('heading', { level: 3, name: 'Does it dim?' })).toBeInTheDocument();
    expect(screen.getByText('Yes, down to candle light.')).toBeInTheDocument();
  });

  it('renders final_cta with title, body and a CTA that hands off to the purchase control', () => {
    renderProjectedProduct();

    expect(screen.getByRole('heading', { level: 2, name: 'Bring one home' })).toBeInTheDocument();
    expect(screen.getByText('Free returns within 30 days.')).toBeInTheDocument();

    const cta = screen.getByRole('link', { name: 'Add to Cart' });
    expect(cta).toHaveAttribute('href', '#purchase-control');
  });

  it('skips disabled sections and unknown section types', () => {
    renderProjectedProduct();

    expect(screen.queryByText('Disabled heading')).not.toBeInTheDocument();
    expect(screen.queryByText('Watch the film')).not.toBeInTheDocument();
  });

  it('never leaks raw JSON or object dumps into the page', () => {
    const { container } = renderProjectedProduct();

    const text = container.textContent ?? '';
    expect(text).not.toContain('[object Object]');
    expect(text).not.toContain('{"');
    expect(text).not.toContain('"items"');
  });

  it('renders projected Arabic content as served, without re-localizing', () => {
    const { container } = renderProjectedProduct('ar');

    const text = container.textContent ?? '';
    // The Arabic strings arrive already projected; the theme renders them as-is.
    expect(text).toContain('Hand-assembled with a brushed brass finish.');
    // An en/ar envelope lookup would have hidden the projected strings entirely.
    expect(text).not.toContain('[object Object]');
  });

  it('renders nothing for sections with missing or malformed content', () => {
    const context = buildContext({ store: storeA, locale: 'en' });
    const model = detailModel({
      context,
      store: storeA,
      product: {
        ...productDetailA,
        sections: [
          { id: 's1', type: 'description', enabled: true, sort_order: 1, content: null },
          { id: 's2', type: 'description', enabled: true, sort_order: 2, content: { heading: 42, body: [] } },
          { id: 's3', type: 'highlights', enabled: true, sort_order: 3, content: {} },
          { id: 's4', type: 'image_text', enabled: true, sort_order: 4, content: { layout: 'diagonal' } },
          { id: 's5', type: 'specifications', enabled: true, sort_order: 5, content: { items: 'not-a-list' } },
          { id: 's6', type: 'faq', enabled: true, sort_order: 6, content: { items: [{ nope: true }] } },
          { id: 's7', type: 'final_cta', enabled: true, sort_order: 7, content: 'string-not-object' }
        ]
      } as ProductDetail
    });

    const { container } = renderInDocument(
      <Layout context={context}>
        <ProductDetail context={context} model={model} />
      </Layout>,
      'en'
    );

    expect(container.querySelector('.product-page-section')).toBeNull();
    const text = container.textContent ?? '';
    expect(text).not.toContain('[object Object]');
    expect(text).not.toContain('{"');
  });
});
