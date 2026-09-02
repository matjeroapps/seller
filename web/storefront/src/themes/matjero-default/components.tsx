import type { CategoryCardModel, ProductCardModel, ThemeContext } from '../contract';

/**
 * Shared presentational pieces of the Matjero default theme.
 *
 * Every component here is a server component: none of them holds state, so none of
 * them ships JavaScript to the browser. Interactivity in this theme is either a
 * native form submission or a link, which is why a catalog page hydrates nothing.
 */

export function ProductCard({
  product,
  context
}: {
  product: ProductCardModel;
  context: ThemeContext;
}) {
  const detailed = context.settings.productCardLayout === 'detailed';

  return (
    <article className="card">
      <a className="card__link" href={product.href}>
        <div className="card__media">
          {product.image ? (
            // A plain <img>, not next/image: tenant media hosts are seller-controlled and
            // unbounded, so the optimizer's host allowlist cannot be configured safely.
            // See the rendering report.
            <img
              className="card__image"
              src={product.image.uri}
              alt={product.image.alt}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="card__placeholder" aria-hidden="true" />
          )}
          {!product.available && !detailed ? (
            // In the detailed layout the stock line below already says this, and
            // repeating it would make a screen reader announce it twice.
            <span className="card__badge">{product.availabilityLabel}</span>
          ) : null}
        </div>
        <div className="card__body">
          <h3 className="card__title">{product.name}</h3>
          {detailed && product.summary ? <p className="card__summary">{product.summary}</p> : null}
          <p className="card__price">{product.price.formatted}</p>
          {detailed ? (
            <p className={product.available ? 'card__stock' : 'card__stock card__stock--out'}>
              {product.availabilityLabel}
            </p>
          ) : null}
        </div>
      </a>
    </article>
  );
}

export function CategoryCard({ category }: { category: CategoryCardModel }) {
  return (
    <article className="tile">
      <a className="tile__link" href={category.href}>
        <h3 className="tile__title">{category.name}</h3>
        {category.description ? <p className="tile__text">{category.description}</p> : null}
      </a>
    </article>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty" role="status">
      <p className="empty__title">{title}</p>
      {hint ? <p className="empty__hint">{hint}</p> : null}
    </div>
  );
}

export function SectionHeading({ title, action }: { title: string; action?: { href: string; label: string } }) {
  return (
    <div className="section__head">
      <h2 className="section__title">{title}</h2>
      {action ? (
        <a className="section__action" href={action.href}>
          {action.label}
        </a>
      ) : null}
    </div>
  );
}
