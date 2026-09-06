import { directionFor, type Dictionary, type Locale } from '../../i18n/locales';
import type { ThemeContext, ThemeDefinition } from '../contract';
import { cssVariablesFor } from '../settings';
import { BoutiqueAnnouncement, BoutiqueFooter, BoutiqueHeader } from './chrome';
import { Category, Home, ProductDetail, ProductList, SearchResults } from './pages';

/**
 * Matjero Boutique Theme.
 *
 * Designed for luxury boutique merchandise, compact product cards, typography-driven
 * framing, and seamless shared section rendering.
 */

function Layout({ context, children }: { context: ThemeContext; children: React.ReactNode }) {
  const { copy, settings } = context;

  return (
    <div className="theme theme--boutique" data-spacing={settings.tokens.spacing} style={cssVariablesFor(settings.tokens)}>
      <a className="skip" href="#main">
        {copy.navigation.skipToContent}
      </a>
      <BoutiqueAnnouncement context={context} />
      <BoutiqueHeader context={context} />
      <main className="main" id="main">
        {children}
      </main>
      <BoutiqueFooter context={context} />
    </div>
  );
}

function NotFound({ context }: { context: ThemeContext }) {
  const { copy, links } = context;
  return (
    <div className="boutique-notice">
      <h1 className="boutique-notice__title">{copy.notFound.heading}</h1>
      <p className="boutique-notice__text">{copy.notFound.body}</p>
      <a className="boutique-button" href={links.home}>
        {copy.notFound.backHome}
      </a>
    </div>
  );
}

function Unavailable({ locale, copy }: { locale: Locale; copy: Dictionary }) {
  return (
    <div className="standalone" dir={directionFor(locale)}>
      <div className="boutique-notice">
        <h1 className="boutique-notice__title">{copy.unavailable.heading}</h1>
        <p className="boutique-notice__text">{copy.unavailable.body}</p>
      </div>
    </div>
  );
}

function ErrorState({ locale, copy, reset }: { locale: Locale; copy: Dictionary; reset?: () => void }) {
  return (
    <div className="standalone" dir={directionFor(locale)}>
      <div className="boutique-notice">
        <h1 className="boutique-notice__title">{copy.error.heading}</h1>
        <p className="boutique-notice__text">{copy.error.body}</p>
        {reset ? (
          <button className="boutique-button" type="button" onClick={reset}>
            {copy.error.retry}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export const matjeroBoutiqueTheme: ThemeDefinition = {
  key: 'matjero-boutique',
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
