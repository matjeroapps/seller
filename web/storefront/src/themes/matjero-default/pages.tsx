import { format } from '../../i18n/locales';
import type {
  CategoryViewModel,
  HomeViewModel,
  ProductDetailViewModel,
  ProductListViewModel,
  SearchViewModel,
  ThemeContext
} from '../contract';
import { CategoryCard, EmptyState, ProductCard, SectionHeading } from './components';
import { PurchaseControl } from './PurchaseControl';

/**
 * The page bodies of the Matjero default theme.
 *
 * Every component takes a view model and renders it. None fetches, none computes a
 * price, none decides availability. Heading levels descend from the single `h1` each
 * page owns, and landmark roles come from real elements rather than ARIA attributes.
 */

function ProductGrid({
  context,
  model
}: {
  context: ThemeContext;
  model: ProductListViewModel;
}) {
  if (model.products.length === 0) {
    return <EmptyState title={context.copy.products.empty} hint={context.copy.products.emptyHint} />;
  }

  return (
    <ul className="grid" role="list">
      {model.products.map((product) => (
        <li className="grid__item" key={product.slug}>
          <ProductCard product={product} context={context} />
        </li>
      ))}
    </ul>
  );
}

function Pagination({ context, model }: { context: ThemeContext; model: ProductListViewModel }) {
  const { copy } = context;
  const { pagination } = model;
  if (pagination.pages <= 1) {
    return null;
  }

  return (
    <nav className="pager" aria-label={copy.pagination.label}>
      {pagination.previousHref ? (
        <a className="pager__link" href={pagination.previousHref} rel="prev">
          {copy.pagination.previous}
        </a>
      ) : (
        <span className="pager__link pager__link--muted">{copy.pagination.previous}</span>
      )}
      <p className="pager__status">
        {format(copy.pagination.status, { page: pagination.page, pages: pagination.pages })}
      </p>
      {pagination.nextHref ? (
        <a className="pager__link" href={pagination.nextHref} rel="next">
          {copy.pagination.next}
        </a>
      ) : (
        <span className="pager__link pager__link--muted">{copy.pagination.next}</span>
      )}
    </nav>
  );
}

/**
 * The refine form.
 *
 * A plain GET form: submitting it navigates, so filter and sort state stays in the
 * URL and every listing remains server-rendered and shareable.
 */
function Refine({ context, model }: { context: ThemeContext; model: ProductListViewModel }) {
  const { copy } = context;

  return (
    <form className="refine" action={model.formAction} method="get">
      <h2 className="visually-hidden">{copy.filters.heading}</h2>
      {model.keyword ? <input type="hidden" name="q" value={model.keyword} /> : null}
      <div className="refine__field">
        <label className="refine__label" htmlFor="refine-sort">
          {copy.filters.sort}
        </label>
        <select
          className="refine__select"
          id="refine-sort"
          name="sort"
          defaultValue={model.sortOptions.find((option) => option.selected)?.value ?? 'newest'}
        >
          {model.sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="refine__field">
        <label className="refine__label" htmlFor="refine-availability">
          {copy.filters.availability}
        </label>
        <select
          className="refine__select"
          id="refine-availability"
          name="availability"
          defaultValue={model.availabilityOptions.find((option) => option.selected)?.value ?? ''}
        >
          {model.availabilityOptions.map((option) => (
            <option key={option.value || 'any'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <button className="refine__submit" type="submit">
        {copy.filters.apply}
      </button>
    </form>
  );
}

function Listing({ context, model }: { context: ThemeContext; model: ProductListViewModel }) {
  const { copy } = context;

  return (
    <>
      <div className="listing__head">
        <h1 className="page__title">{model.heading}</h1>
        <p className="listing__count">
          {format(copy.products.resultCount, { count: model.pagination.total })}
        </p>
      </div>
      <Refine context={context} model={model} />
      <ProductGrid context={context} model={model} />
      <Pagination context={context} model={model} />
    </>
  );
}

export function Home({ context, model }: { context: ThemeContext; model: HomeViewModel }) {
  const { branding, copy } = context;

  return (
    <>
      {model.hero ? (
        <section className="hero" aria-labelledby="hero-title">
          {model.hero.imageUrl ? (
            // A plain <img>; see ProductCard.
            <img className="hero__image" src={model.hero.imageUrl} alt="" aria-hidden="true" />
          ) : null}
          <div className="hero__content">
            <h1 className="hero__title" id="hero-title">
              {model.hero.title || branding.name}
            </h1>
            {model.hero.subtitle ? <p className="hero__subtitle">{model.hero.subtitle}</p> : null}
            {model.hero.ctaUrl && model.hero.ctaLabel ? (
              <a className="button" href={model.hero.ctaUrl}>
                {model.hero.ctaLabel}
              </a>
            ) : (
              <a className="button" href={model.browseAllHref}>
                {copy.home.shopNow}
              </a>
            )}
          </div>
        </section>
      ) : (
        <section className="hero hero--plain">
          <div className="hero__content">
            <h1 className="hero__title">{branding.name}</h1>
            <a className="button" href={model.browseAllHref}>
              {copy.home.shopNow}
            </a>
          </div>
        </section>
      )}

      {model.sections.map((section, index) => {
        const heading =
          section.title ||
          (section.kind === 'category_grid'
            ? copy.home.categories
            : section.kind === 'product_carousel'
              ? copy.home.newArrivals
              : copy.home.featured);

        if (section.kind === 'category_grid') {
          if (section.categories.length === 0) {
            return null;
          }
          return (
            <section className="section" key={`${section.kind}-${index}`}>
              <SectionHeading title={heading} />
              <ul className="tiles" role="list">
                {section.categories.map((category) => (
                  <li key={category.slug}>
                    <CategoryCard category={category} />
                  </li>
                ))}
              </ul>
            </section>
          );
        }

        if (section.products.length === 0) {
          return null;
        }
        return (
          <section
            className={section.kind === 'product_carousel' ? 'section section--rail' : 'section'}
            key={`${section.kind}-${index}`}
          >
            <SectionHeading
              title={heading}
              action={{ href: model.browseAllHref, label: copy.home.browseAll }}
            />
            <ul className={section.kind === 'product_carousel' ? 'rail' : 'grid'} role="list">
              {section.products.map((product) => (
                <li className={section.kind === 'product_carousel' ? 'rail__item' : 'grid__item'} key={product.slug}>
                  <ProductCard product={product} context={context} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

export function ProductList({ context, model }: { context: ThemeContext; model: ProductListViewModel }) {
  return (
    <div className="listing">
      <Listing context={context} model={model} />
    </div>
  );
}

export function Category({ context, model }: { context: ThemeContext; model: CategoryViewModel }) {
  const { copy } = context;

  return (
    <div className={`listing listing--${context.settings.categoryLayout}`}>
      <nav className="crumbs" aria-label={copy.navigation.breadcrumb}>
        <a href={context.links.home}>{copy.navigation.home}</a>
        <span aria-hidden="true">/</span>
        <a href={context.links.products}>{copy.navigation.products}</a>
      </nav>
      <div className="listing__head">
        <h1 className="page__title">{model.category.name}</h1>
        <p className="listing__count">
          {format(copy.category.productCount, { count: model.list.pagination.total })}
        </p>
      </div>
      {model.parentName ? (
        <p className="listing__parent">{format(copy.category.parent, { name: model.parentName })}</p>
      ) : null}
      {model.category.description ? <p className="listing__intro">{model.category.description}</p> : null}
      <Refine context={context} model={model.list} />
      {model.list.products.length === 0 ? (
        <EmptyState title={copy.category.empty} />
      ) : (
        <ProductGrid context={context} model={model.list} />
      )}
      <Pagination context={context} model={model.list} />
    </div>
  );
}

export function ProductDetail({
  context,
  model
}: {
  context: ThemeContext;
  model: ProductDetailViewModel;
}) {
  const { copy } = context;
  const [primary, ...rest] = model.images;

  return (
    <article className="product">
      <nav className="crumbs" aria-label={copy.navigation.breadcrumb}>
        <a href={context.links.home}>{copy.navigation.home}</a>
        <span aria-hidden="true">/</span>
        <a href={context.links.products}>{copy.navigation.products}</a>
      </nav>

      <div className="product__layout">
        <div className="product__media">
          {primary ? (
            <>
              {/* A plain <img>; see ProductCard. */}
              <img className="product__image" src={primary.uri} alt={primary.alt} />
              {rest.length > 0 ? (
                <ul className="product__thumbs" role="list" aria-label={copy.product.gallery}>
                  {rest.map((image) => (
                    <li key={image.uri}>
                      <img className="product__thumb" src={image.uri} alt={image.alt} loading="lazy" />
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <div className="product__image product__image--empty" role="img" aria-label={copy.products.noImage} />
          )}
        </div>

        <div className="product__info">
          <h1 className="product__title">{model.name}</h1>
          <p className="product__price">
            <span className="visually-hidden">{copy.product.priceLabel}: </span>
            {model.price.formatted}
          </p>
          <p className={model.available ? 'product__stock' : 'product__stock product__stock--out'}>
            <span className="visually-hidden">{copy.availability.label}: </span>
            {model.availabilityLabel}
          </p>

          {model.description ? (
            <section className="product__section">
              <h2 className="product__heading">{copy.product.description}</h2>
              <p className="product__text">{model.description}</p>
            </section>
          ) : null}

          <PurchaseControl
            variants={model.variants}
            defaultSkuId={model.defaultSkuId}
            available={model.available}
            copy={copy}
            locale={context.locale}
          />

          {model.categories.length > 0 ? (
            <section className="product__section">
              <h2 className="product__heading">{copy.product.inCategories}</h2>
              <ul className="chips" role="list">
                {model.categories.map((category) => (
                  <li key={category.href}>
                    <a className="chip" href={category.href}>
                      {category.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function SearchResults({ context, model }: { context: ThemeContext; model: SearchViewModel }) {
  const { copy } = context;

  return (
    <div className="listing">
      <h1 className="page__title">
        {model.keyword ? format(copy.search.resultsFor, { query: model.keyword }) : copy.search.heading}
      </h1>

      <form className="search search--page" action={model.list.formAction} method="get" role="search">
        <label className="search__label" htmlFor="search-page-input">
          {copy.search.label}
        </label>
        <div className="search__control">
          <input
            className="search__input"
            id="search-page-input"
            type="search"
            name="q"
            defaultValue={model.keyword}
            placeholder={copy.search.placeholder}
          />
          <button className="search__submit" type="submit">
            {copy.search.submit}
          </button>
        </div>
      </form>

      {!model.keyword ? (
        <EmptyState title={copy.search.prompt} />
      ) : model.list.products.length === 0 ? (
        <EmptyState title={copy.search.empty} hint={copy.search.emptyHint} />
      ) : (
        <>
          <p className="listing__count">
            {format(copy.products.resultCount, { count: model.list.pagination.total })}
          </p>
          <ProductGrid context={context} model={model.list} />
          <Pagination context={context} model={model.list} />
        </>
      )}
    </div>
  );
}

export function NotFound({ context }: { context: ThemeContext }) {
  const { copy, links } = context;

  return (
    <div className="notice">
      <h1 className="notice__title">{copy.notFound.heading}</h1>
      <p className="notice__text">{copy.notFound.body}</p>
      <a className="button" href={links.home}>
        {copy.notFound.backHome}
      </a>
    </div>
  );
}
