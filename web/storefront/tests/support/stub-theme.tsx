import type {
  CategoryViewModel,
  HomeViewModel,
  ProductDetailViewModel,
  ProductListViewModel,
  SearchViewModel,
  ThemeContext,
  ThemeDefinition
} from '../../src/themes/contract';
import type { Dictionary, Locale } from '../../src/i18n/locales';

/**
 * A stub second theme.
 *
 * It renders the same view models with a completely different component set and markup —
 * tables and definition lists instead of cards and grids — and shares nothing with the
 * production theme. Its purpose is to prove that a theme swap requires no change to the
 * API client, the page loaders or the view models: it consumes exactly the objects they
 * already produce.
 *
 * It is deliberately not a second production theme. It exists to exercise the boundary.
 */

const MARKER = 'stub-theme';

function Layout({ context, children }: { context: ThemeContext; children: React.ReactNode }) {
  return (
    <div data-theme={MARKER} data-locale={context.locale} data-direction={context.direction}>
      <header>
        <p data-testid="stub-brand">{context.branding.name}</p>
      </header>
      <main id="main">{children}</main>
      <footer>
        <p>{context.copy.footer.heading}</p>
      </footer>
    </div>
  );
}

function rows(model: ProductListViewModel) {
  return (
    <table data-testid="stub-products">
      <caption>{model.heading}</caption>
      <tbody>
        {model.products.map((product) => (
          <tr key={product.slug}>
            <th scope="row">
              <a href={product.href}>{product.name}</a>
            </th>
            <td>{product.price.formatted}</td>
            <td>{product.availabilityLabel}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Home({ context, model }: { context: ThemeContext; model: HomeViewModel }) {
  return (
    <section>
      <h1 data-testid="stub-heading">{model.hero?.title ?? context.branding.name}</h1>
      {model.sections.map((section, index) => (
        <section key={`${section.kind}-${index}`}>
          <h2>{section.title || section.kind}</h2>
          <ol data-testid={`stub-section-${section.kind}`}>
            {section.products.map((product) => (
              <li key={product.slug}>
                {product.name} — {product.price.formatted}
              </li>
            ))}
            {section.categories.map((category) => (
              <li key={category.slug}>{category.name}</li>
            ))}
          </ol>
        </section>
      ))}
    </section>
  );
}

function ProductList({ model }: { context: ThemeContext; model: ProductListViewModel }) {
  return (
    <section>
      <h1 data-testid="stub-heading">{model.heading}</h1>
      {rows(model)}
    </section>
  );
}

function Category({ model }: { context: ThemeContext; model: CategoryViewModel }) {
  return (
    <section>
      <h1 data-testid="stub-heading">{model.category.name}</h1>
      {rows(model.list)}
    </section>
  );
}

function ProductDetail({ context, model }: { context: ThemeContext; model: ProductDetailViewModel }) {
  return (
    <section>
      <h1 data-testid="stub-heading">{model.name}</h1>
      <dl data-testid="stub-detail">
        <dt>{context.copy.product.priceLabel}</dt>
        <dd>{model.price.formatted}</dd>
        <dt>{context.copy.availability.label}</dt>
        <dd>{model.availabilityLabel}</dd>
      </dl>
    </section>
  );
}

function SearchResults({ model }: { context: ThemeContext; model: SearchViewModel }) {
  return (
    <section>
      <h1 data-testid="stub-heading">{model.keyword}</h1>
      {rows(model.list)}
    </section>
  );
}

function NotFound({ context }: { context: ThemeContext }) {
  return <h1 data-testid="stub-heading">{context.copy.notFound.heading}</h1>;
}

function Unavailable({ copy }: { locale: Locale; copy: Dictionary }) {
  return <h1 data-testid="stub-heading">{copy.unavailable.heading}</h1>;
}

function ErrorState({ copy }: { locale: Locale; copy: Dictionary; reset?: () => void }) {
  return <h1 data-testid="stub-heading">{copy.error.heading}</h1>;
}

export const stubTheme: ThemeDefinition = {
  key: MARKER,
  versions: ['1.0.0'],
  components: {
    Layout,
    Home,
    ProductList,
    ProductDetail,
    Category,
    SearchResults,
    NotFound,
    Unavailable,
    ErrorState
  }
};
