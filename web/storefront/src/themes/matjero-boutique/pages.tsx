import { format } from '../../i18n/locales';
import type {
  CategoryViewModel,
  HomeViewModel,
  ProductCardModel,
  ProductDetailViewModel,
  ProductListViewModel,
  SearchViewModel,
  ThemeContext
} from '../contract';
import { SharedProductSections } from '../shared/ProductSections';
import { PurchaseControl } from '../matjero-default/PurchaseControl';

/**
 * Boutique theme page components.
 *
 * Designed with compact editorial grids, clean card typography, distinct image
 * framing, and seamless shared section kit integration.
 */

function BoutiqueProductCard({ product, context }: { product: ProductCardModel; context: ThemeContext }) {
  const isDetailed = context.settings.productCardLayout === 'detailed';

  return (
    <article className="boutique-card">
      <a href={product.href} className="boutique-card__link">
        <div className="boutique-card__media">
          {product.image ? (
            <img src={product.image.uri} alt={product.image.alt} className="boutique-card__img" loading="lazy" decoding="async" />
          ) : (
            <div className="boutique-card__placeholder" aria-hidden="true" />
          )}
          {!product.available ? (
            <span className="boutique-card__badge">{product.availabilityLabel}</span>
          ) : null}
        </div>
        <div className="boutique-card__body">
          <h3 className="boutique-card__title">{product.name}</h3>
          {isDetailed && product.summary ? (
            <p className="boutique-card__summary">{product.summary}</p>
          ) : null}
          <p className="boutique-card__price">{product.price.formatted}</p>
        </div>
      </a>
    </article>
  );
}

function BoutiqueCategoryTile({ category }: { category: CategoryViewModel['category'] }) {
  return (
    <article className="boutique-tile">
      <a href={category.href} className="boutique-tile__link">
        <h3 className="boutique-tile__title">{category.name}</h3>
        {category.description ? <p className="boutique-tile__text">{category.description}</p> : null}
      </a>
    </article>
  );
}

function BoutiquePager({
  pagination,
  context
}: {
  pagination: ProductListViewModel['pagination'];
  context: ThemeContext;
}) {
  const { copy } = context;
  if (pagination.pages <= 1) return null;

  return (
    <nav className="boutique-pager" aria-label={copy.pagination.label}>
      {pagination.previousHref ? (
        <a href={pagination.previousHref} className="boutique-pager__link" rel="prev">
          {copy.pagination.previous}
        </a>
      ) : (
        <span className="boutique-pager__link boutique-pager__link--disabled">{copy.pagination.previous}</span>
      )}
      <span className="boutique-pager__status">
        {format(copy.pagination.status, { page: pagination.page, pages: pagination.pages })}
      </span>
      {pagination.nextHref ? (
        <a href={pagination.nextHref} className="boutique-pager__link" rel="next">
          {copy.pagination.next}
        </a>
      ) : (
        <span className="boutique-pager__link boutique-pager__link--disabled">{copy.pagination.next}</span>
      )}
    </nav>
  );
}

export function Home({ context, model }: { context: ThemeContext; model: HomeViewModel }) {
  const { branding, copy } = context;

  return (
    <div className="boutique-home">
      {model.hero ? (
        <section className="boutique-hero" aria-labelledby="boutique-hero-title">
          {model.hero.imageUrl ? (
            <img src={model.hero.imageUrl} alt="" className="boutique-hero__img" aria-hidden="true" />
          ) : null}
          <div className="boutique-hero__content">
            <h1 className="boutique-hero__title" id="boutique-hero-title">
              {model.hero.title || branding.name}
            </h1>
            {model.hero.subtitle ? <p className="boutique-hero__subtitle">{model.hero.subtitle}</p> : null}
            {model.hero.ctaUrl && model.hero.ctaLabel ? (
              <a href={model.hero.ctaUrl} className="boutique-button">
                {model.hero.ctaLabel}
              </a>
            ) : (
              <a href={model.browseAllHref} className="boutique-button">
                {copy.home.shopNow}
              </a>
            )}
          </div>
        </section>
      ) : (
        <section className="boutique-hero boutique-hero--minimal">
          <h1 className="boutique-hero__title">{branding.name}</h1>
          <a href={model.browseAllHref} className="boutique-button">
            {copy.home.shopNow}
          </a>
        </section>
      )}

      {model.sections.map((sec, idx) => {
        const title =
          sec.title ||
          (sec.kind === 'category_grid'
            ? copy.home.categories
            : sec.kind === 'product_carousel'
              ? copy.home.newArrivals
              : copy.home.featured);

        if (sec.kind === 'category_grid') {
          if (sec.categories.length === 0) return null;
          return (
            <section key={`cat-${idx}`} className="boutique-section">
              <h2 className="boutique-section__title">{title}</h2>
              <div className="boutique-grid boutique-grid--tiles">
                {sec.categories.map((cat) => (
                  <BoutiqueCategoryTile key={cat.slug} category={cat} />
                ))}
              </div>
            </section>
          );
        }

        if (sec.products.length === 0) return null;
        return (
          <section key={`prod-${idx}`} className="boutique-section">
            <div className="boutique-section__head">
              <h2 className="boutique-section__title">{title}</h2>
              <a href={model.browseAllHref} className="boutique-section__link">
                {copy.home.browseAll}
              </a>
            </div>
            <div className="boutique-grid">
              {sec.products.map((prod) => (
                <BoutiqueProductCard key={prod.slug} product={prod} context={context} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function ProductList({ context, model }: { context: ThemeContext; model: ProductListViewModel }) {
  const { copy } = context;

  return (
    <div className="boutique-listing">
      <header className="boutique-listing__header">
        <h1 className="boutique-page-title">{model.heading}</h1>
        <p className="boutique-listing__count">
          {format(copy.products.resultCount, { count: model.pagination.total })}
        </p>
      </header>

      {model.products.length === 0 ? (
        <div className="boutique-empty" role="status">
          <p className="boutique-empty__title">{copy.products.empty}</p>
          <p className="boutique-empty__hint">{copy.products.emptyHint}</p>
        </div>
      ) : (
        <div className="boutique-grid">
          {model.products.map((prod) => (
            <BoutiqueProductCard key={prod.slug} product={prod} context={context} />
          ))}
        </div>
      )}

      <BoutiquePager pagination={model.pagination} context={context} />
    </div>
  );
}

export function ProductDetail({ context, model }: { context: ThemeContext; model: ProductDetailViewModel }) {
  const { copy, links, locale } = context;
  const [mainImage, ...gallery] = model.images;

  return (
    <article className="boutique-product">
      <nav className="boutique-crumbs" aria-label={copy.navigation.breadcrumb}>
        <a href={links.home}>{copy.navigation.home}</a>
        <span aria-hidden="true">/</span>
        <a href={links.products}>{copy.navigation.products}</a>
      </nav>

      <div className="boutique-product__layout">
        <div className="boutique-product__gallery">
          {mainImage ? (
            <>
              <img src={mainImage.uri} alt={mainImage.alt} className="boutique-product__main-img" />
              {gallery.length > 0 ? (
                <div className="boutique-product__thumbs" role="list" aria-label={copy.product.gallery}>
                  {gallery.map((img) => (
                    <img key={img.uri} src={img.uri} alt={img.alt} className="boutique-product__thumb" loading="lazy" />
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="boutique-product__empty-img" role="img" aria-label={copy.products.noImage} />
          )}
        </div>

        <div className="boutique-product__info">
          <h1 className="boutique-product__title">{model.name}</h1>
          <p className="boutique-product__price">{model.price.formatted}</p>
          <p className={`boutique-product__stock ${model.available ? '' : 'boutique-product__stock--out'}`}>
            {model.availabilityLabel}
          </p>

          {model.description ? (
            <section className="boutique-product__desc">
              <h2 className="boutique-product__heading">{copy.product.description}</h2>
              <p>{model.description}</p>
            </section>
          ) : null}

          <PurchaseControl
            variants={model.variants}
            defaultSkuId={model.defaultSkuId}
            available={model.available}
            copy={copy}
            locale={locale}
            purchaseBehavior={model.purchaseBehavior}
          />
        </div>
      </div>

      {model.sections && model.sections.length > 0 ? (
        <SharedProductSections sections={model.sections} context={context} />
      ) : null}
    </article>
  );
}

export function Category({ context, model }: { context: ThemeContext; model: CategoryViewModel }) {
  const { copy, links } = context;

  return (
    <div className="boutique-category">
      <nav className="boutique-crumbs" aria-label={copy.navigation.breadcrumb}>
        <a href={links.home}>{copy.navigation.home}</a>
        <span aria-hidden="true">/</span>
        <a href={links.products}>{copy.navigation.products}</a>
      </nav>

      <header className="boutique-category__header">
        <h1 className="boutique-page-title">{model.category.name}</h1>
        {model.parentName ? (
          <p className="boutique-category__parent">{format(copy.category.parent, { name: model.parentName })}</p>
        ) : null}
        {model.category.description ? <p className="boutique-category__desc">{model.category.description}</p> : null}
      </header>

      {model.list.products.length === 0 ? (
        <div className="boutique-empty" role="status">
          <p className="boutique-empty__title">{copy.category.empty}</p>
        </div>
      ) : (
        <div className="boutique-grid">
          {model.list.products.map((prod) => (
            <BoutiqueProductCard key={prod.slug} product={prod} context={context} />
          ))}
        </div>
      )}

      <BoutiquePager pagination={model.list.pagination} context={context} />
    </div>
  );
}

export function SearchResults({ context, model }: { context: ThemeContext; model: SearchViewModel }) {
  const { copy } = context;

  return (
    <div className="boutique-search">
      <h1 className="boutique-page-title">
        {model.keyword ? format(copy.search.resultsFor, { query: model.keyword }) : copy.search.heading}
      </h1>

      {model.keyword ? (
        model.list.products.length === 0 ? (
          <div className="boutique-empty" role="status">
            <p className="boutique-empty__title">{copy.search.empty}</p>
            <p className="boutique-empty__hint">{copy.search.emptyHint}</p>
          </div>
        ) : (
          <>
            <p className="boutique-search__count">
              {format(copy.products.resultCount, { count: model.list.pagination.total })}
            </p>
            <div className="boutique-grid">
              {model.list.products.map((prod) => (
                <BoutiqueProductCard key={prod.slug} product={prod} context={context} />
              ))}
            </div>
            <BoutiquePager pagination={model.list.pagination} context={context} />
          </>
        )
      ) : (
        <div className="boutique-empty" role="status">
          <p className="boutique-empty__title">{copy.search.prompt}</p>
        </div>
      )}
    </div>
  );
}
