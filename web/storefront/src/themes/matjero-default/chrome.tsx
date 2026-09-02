import { format } from '../../i18n/locales';
import type { ThemeContext } from '../contract';

/**
 * Header, navigation, footer and the search form.
 *
 * The mobile menu is a `<details>` element and the search box is a `<form method="get">`.
 * Both work without JavaScript, keep the storefront's browse state in the URL, and
 * cost the customer no hydration.
 */

function SearchForm({ context, variant }: { context: ThemeContext; variant: 'header' | 'menu' }) {
  const { copy, links } = context;
  const id = `storefront-search-${variant}`;

  return (
    <form className={`search search--${variant}`} action={links.search} method="get" role="search">
      <label className="search__label" htmlFor={id}>
        {copy.search.label}
      </label>
      <div className="search__control">
        <input
          className="search__input"
          id={id}
          type="search"
          name="q"
          placeholder={copy.search.placeholder}
          autoComplete="off"
        />
        <button className="search__submit" type="submit">
          {copy.search.submit}
        </button>
      </div>
    </form>
  );
}

function NavLinks({ context }: { context: ThemeContext }) {
  const { copy, links, navigationCategories, settings } = context;

  return (
    <ul className="nav__list">
      <li>
        <a className="nav__link" href={links.home}>
          {copy.navigation.home}
        </a>
      </li>
      <li>
        <a className="nav__link" href={links.products}>
          {copy.navigation.products}
        </a>
      </li>
      {navigationCategories.length > 0 ? (
        settings.navigationStyle === 'dropdown' ? (
          <li className="nav__group">
            <details className="dropdown">
              <summary className="nav__link nav__link--summary">{copy.navigation.categories}</summary>
              <ul className="dropdown__list">
                {navigationCategories.map((category) => (
                  <li key={category.slug}>
                    <a className="dropdown__link" href={category.href}>
                      {category.name}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ) : (
          navigationCategories.slice(0, 4).map((category) => (
            <li key={category.slug}>
              <a className="nav__link" href={category.href}>
                {category.name}
              </a>
            </li>
          ))
        )
      ) : null}
    </ul>
  );
}

/**
 * The locale switch.
 *
 * `landmark` is false for the copies inside the mobile menu and the footer. Those sit
 * inside a region that is already labelled, and a second landmark with the same name as
 * the header's would be indistinguishable when navigating by landmark.
 */
function LocaleSwitch({ context, landmark = true }: { context: ThemeContext; landmark?: boolean }) {
  const { copy, localeLinks } = context;
  if (localeLinks.length < 2) {
    return null;
  }

  const list = (
    <ul className="locales__list">
      {localeLinks.map((link) => (
        <li key={link.locale}>
          <a
            className={link.current ? 'locales__link locales__link--current' : 'locales__link'}
            href={link.href}
            lang={link.locale}
            hrefLang={link.locale}
            aria-current={link.current ? 'true' : undefined}
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );

  if (!landmark) {
    return <div className="locales">{list}</div>;
  }

  return (
    <nav className="locales" aria-label={copy.navigation.localeLabel}>
      {list}
    </nav>
  );
}

function Brand({ context }: { context: ThemeContext }) {
  const { branding, copy, links } = context;

  return (
    <a className="brand" href={links.home} aria-label={copy.navigation.storeHome}>
      {branding.logoUrl ? (
        // A plain <img>; see ProductCard.
        <img className="brand__logo" src={branding.logoUrl} alt={branding.name} />
      ) : (
        <span className="brand__mark" aria-hidden="true">
          {branding.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="brand__name">{branding.name}</span>
    </a>
  );
}

export function Announcement({ context }: { context: ThemeContext }) {
  const bar = context.settings.announcement;
  if (!bar) {
    return null;
  }

  return (
    <div
      className="announcement"
      style={{ background: bar.backgroundColor, color: bar.textColor }}
      role="note"
    >
      <p className="announcement__text">{bar.text}</p>
    </div>
  );
}

export function Header({ context }: { context: ThemeContext }) {
  const { copy, settings } = context;

  return (
    <header className={`header header--${settings.headerLayout}`}>
      <div className="header__bar">
        <Brand context={context} />
        <nav className="nav nav--desktop" aria-label={copy.navigation.primary}>
          <NavLinks context={context} />
        </nav>
        <div className="header__tools">
          {settings.showSearch ? <SearchForm context={context} variant="header" /> : null}
          <LocaleSwitch context={context} />
        </div>
      </div>
      <details className="menu">
        <summary className="menu__toggle">{copy.navigation.menu}</summary>
        <div className="menu__panel">
          {/* Labelled as the menu, not "Primary": the desktop nav already owns that name,
              and two landmarks with one name are indistinguishable to a screen reader. */}
          <nav aria-label={copy.navigation.menu}>
            <NavLinks context={context} />
          </nav>
          {settings.showSearch ? <SearchForm context={context} variant="menu" /> : null}
          <LocaleSwitch context={context} landmark={false} />
        </div>
      </details>
    </header>
  );
}

export function Footer({ context }: { context: ThemeContext }) {
  const { branding, copy, links, navigationCategories, settings } = context;
  const columns = Math.max(1, Math.min(settings.footerColumns, 4));

  return (
    <footer className="footer">
      <h2 className="visually-hidden">{copy.footer.heading}</h2>
      <div className="footer__grid" data-columns={columns}>
        <div className="footer__column">
          <p className="footer__brand">{branding.name}</p>
        </div>
        {columns > 1 ? (
          <nav className="footer__column" aria-label={copy.navigation.products}>
            <p className="footer__heading">{copy.navigation.products}</p>
            <ul className="footer__list">
              <li>
                <a href={links.products}>{copy.home.browseAll}</a>
              </li>
              <li>
                <a href={links.search}>{copy.search.heading}</a>
              </li>
            </ul>
          </nav>
        ) : null}
        {columns > 2 && navigationCategories.length > 0 ? (
          <nav className="footer__column" aria-label={copy.navigation.categories}>
            <p className="footer__heading">{copy.navigation.categories}</p>
            <ul className="footer__list">
              {navigationCategories.slice(0, 5).map((category) => (
                <li key={category.slug}>
                  <a href={category.href}>{category.name}</a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        {columns > 3 ? (
          <div className="footer__column">
            <p className="footer__heading">{copy.navigation.localeLabel}</p>
            <LocaleSwitch context={context} landmark={false} />
          </div>
        ) : null}
      </div>
      <p className="footer__legal">
        {format(copy.footer.rights, { year: new Date().getFullYear(), store: branding.name })}
      </p>
    </footer>
  );
}
