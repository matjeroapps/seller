import type { ProductDetailViewModel, ThemeContext } from '../contract';
import { safeUrl } from '../settings';
import { PURCHASE_CONTROL_ANCHOR } from './constants';

/**
 * Shared, theme-agnostic product page section renderers.
 *
 * Core serves these sections already locale-projected to the request locale:
 * `content` holds the display strings directly. Every renderer is typed per section
 * kind, and degrades gracefully to rendering nothing when the content is missing
 * or malformed rather than crashing the page. Unknown section types are skipped.
 *
 * `final_cta` uses `PURCHASE_CONTROL_ANCHOR` as an in-page anchor to hand over to
 * the product's purchase control without duplicating cart or checkout logic.
 */

type SectionLike = NonNullable<ProductDetailViewModel['sections']>[number];

/** True only for a plain object, the only content shape a renderer accepts. */
function isContentObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** A list entry the renderer can show; anything structured is dropped, not stringified. */
function strItem(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function DescriptionSection({ content }: { content: Record<string, unknown> }) {
  const heading = str(content.heading);
  const body = str(content.body);
  if (!heading && !body) {
    return null;
  }
  return (
    <section className="product-page-section product-page-section--description">
      {heading ? <h2 className="product-page-section__title">{heading}</h2> : null}
      {body ? <p className="product-page-section__text">{body}</p> : null}
    </section>
  );
}

export function HighlightsSection({ content }: { content: Record<string, unknown> }) {
  const title = str(content.title);
  const items = list(content.items).map(strItem).filter((item) => item.trim() !== '');
  if (!title && items.length === 0) {
    return null;
  }
  return (
    <section className="product-page-section product-page-section--highlights">
      {title ? <h2 className="product-page-section__title">{title}</h2> : null}
      {items.length > 0 ? (
        <ul className="product-page-section__items" role="list">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function ImageTextSection({ content }: { content: Record<string, unknown> }) {
  const heading = str(content.heading);
  const body = str(content.body);
  const layout = content.layout === 'right' ? 'right' : 'left';
  const image = isContentObject(content.image) ? content.image : null;
  const uri = safeUrl(image ? image.uri : undefined, 2048);
  const alt = image ? str(image.alt_text) : '';
  if (!heading && !body && !uri) {
    return null;
  }
  return (
    <section className="product-page-section product-page-section--image_text">
      <div
        className={`product-page-section__image-text${
          layout === 'right' ? ' product-page-section__image-text--right' : ''
        }`}
      >
        {uri ? <img className="product-page-section__media" src={uri} alt={alt} loading="lazy" /> : null}
        {heading || body ? (
          <div className="product-page-section__image-text-copy">
            {heading ? <h2 className="product-page-section__title">{heading}</h2> : null}
            {body ? <p className="product-page-section__text">{body}</p> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function SpecificationsSection({ content }: { content: Record<string, unknown> }) {
  const rows = list(content.items)
    .map((item) => (isContentObject(item) ? { key: str(item.key), value: str(item.value) } : null))
    .filter((row): row is { key: string; value: string } => row !== null && row.key.trim() !== '');
  if (rows.length === 0) {
    return null;
  }
  return (
    <section className="product-page-section product-page-section--specifications">
      <dl className="product-page-section__specs">
        {rows.map((row, index) => (
          <div className="product-page-section__spec-row" key={index}>
            <dt>{row.key}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function FaqSection({ content }: { content: Record<string, unknown> }) {
  const rows = list(content.items)
    .map((item) =>
      isContentObject(item) ? { question: str(item.question), answer: str(item.answer) } : null
    )
    .filter((row): row is { question: string; answer: string } => row !== null && row.question.trim() !== '');
  if (rows.length === 0) {
    return null;
  }
  return (
    <section className="product-page-section product-page-section--faq">
      <ul className="product-page-section__faq" role="list">
        {rows.map((row, index) => (
          <li key={index} className="product-page-section__faq-entry">
            <h3 className="product-page-section__faq-question">{row.question}</h3>
            {row.answer ? <p className="product-page-section__faq-answer">{row.answer}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FinalCtaSection({ content, context }: { content: Record<string, unknown>; context: ThemeContext }) {
  const title = str(content.title);
  const body = str(content.body);
  if (!title && !body) {
    return null;
  }
  const action = content.action === 'buy_now' ? 'buy_now' : 'add_to_cart';
  const ctaLabel = action === 'buy_now' ? context.copy.cart.buyNow : context.copy.cart.addToCart;

  return (
    <section className="product-page-section product-page-section--final_cta">
      {title ? <h2 className="product-page-section__title">{title}</h2> : null}
      {body ? <p className="product-page-section__text">{body}</p> : null}
      <a className="button button--primary product-page-section__cta" href={`#${PURCHASE_CONTROL_ANCHOR}`}>
        {ctaLabel}
      </a>
    </section>
  );
}

export function SectionRenderer({ section, context }: { section: SectionLike; context: ThemeContext }) {
  if (!isContentObject(section.content)) {
    return null;
  }
  switch (section.type) {
    case 'description':
      return <DescriptionSection content={section.content} />;
    case 'highlights':
      return <HighlightsSection content={section.content} />;
    case 'image_text':
      return <ImageTextSection content={section.content} />;
    case 'specifications':
      return <SpecificationsSection content={section.content} />;
    case 'faq':
      return <FaqSection content={section.content} />;
    case 'final_cta':
      return <FinalCtaSection content={section.content} context={context} />;
    default:
      return null;
  }
}

export function SharedProductSections({
  sections,
  context
}: {
  sections: ProductDetailViewModel['sections'];
  context: ThemeContext;
}) {
  if (!Array.isArray(sections)) {
    return null;
  }
  const visible = sections.filter((sec) => sec && sec.enabled !== false && typeof sec.type === 'string');
  if (visible.length === 0) {
    return null;
  }
  return (
    <div className="product__page-sections">
      {visible.map((sec) => (
        <SectionRenderer key={sec.id} section={sec} context={context} />
      ))}
    </div>
  );
}
