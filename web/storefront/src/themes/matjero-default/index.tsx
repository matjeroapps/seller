import { directionFor, type Dictionary, type Locale } from '../../i18n/locales';
import type { ThemeContext, ThemeDefinition } from '../contract';
import { cssVariablesFor } from '../settings';
import { Announcement, Footer, Header } from './chrome';
import { Category, Home, NotFound, ProductDetail, ProductList, SearchResults } from './pages';

/**
 * The Matjero default theme.
 *
 * Layout applies the store's design tokens as CSS custom properties on a wrapper
 * element, through React's `style` prop. No seller value is ever emitted as a
 * stylesheet string, so a configuration value cannot introduce a rule.
 */

function Layout({ context, children }: { context: ThemeContext; children: React.ReactNode }) {
  const { copy, settings } = context;

  return (
    <div className="theme" data-spacing={settings.tokens.spacing} style={cssVariablesFor(settings.tokens)}>
      <a className="skip" href="#main">
        {copy.navigation.skipToContent}
      </a>
      <Announcement context={context} />
      <Header context={context} />
      <main className="main" id="main">
        {children}
      </main>
      <Footer context={context} />
    </div>
  );
}

/**
 * The states rendered outside a store context.
 *
 * `Unavailable` covers an unknown domain and a store that has stopped resolving
 * publicly. It deliberately says the same thing in both cases and names no reason:
 * a customer must not be able to distinguish an unregistered domain from a suspended
 * store, and moderation state is not public information.
 */
function Unavailable({ locale, copy }: { locale: Locale; copy: Dictionary }) {
  return (
    <div className="standalone" dir={directionFor(locale)}>
      <div className="notice">
        <h1 className="notice__title">{copy.unavailable.heading}</h1>
        <p className="notice__text">{copy.unavailable.body}</p>
      </div>
    </div>
  );
}

function ErrorState({ locale, copy, reset }: { locale: Locale; copy: Dictionary; reset?: () => void }) {
  return (
    <div className="standalone" dir={directionFor(locale)}>
      <div className="notice">
        <h1 className="notice__title">{copy.error.heading}</h1>
        <p className="notice__text">{copy.error.body}</p>
        {reset ? (
          <button className="button" type="button" onClick={reset}>
            {copy.error.retry}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export const matjeroDefaultTheme: ThemeDefinition = {
  key: 'matjero-default',
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
