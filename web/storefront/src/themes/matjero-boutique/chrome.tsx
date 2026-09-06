import type { ThemeContext } from '../contract';
import { format } from '../../i18n/locales';

/**
 * Boutique theme chrome components: Announcement, Header, and Footer.
 *
 * Designed with a refined editorial aesthetic, clean typography, compact layout,
 * and first-class RTL/LTR localization.
 */

export function BoutiqueAnnouncement({ context }: { context: ThemeContext }) {
  const announcement = context.settings.announcement;
  if (!announcement) return null;

  return (
    <div
      className="boutique-announcement"
      style={{
        backgroundColor: announcement.backgroundColor,
        color: announcement.textColor
      }}
      role="note"
    >
      <p>{announcement.text}</p>
    </div>
  );
}

export function BoutiqueHeader({ context }: { context: ThemeContext }) {
  const { branding, copy, links, navigationCategories, settings, localeLinks } = context;

  return (
    <header className={`boutique-header boutique-header--${settings.headerLayout}`}>
      <div className="boutique-header__inner">
        <div className="boutique-header__brand">
          <a href={links.home} className="boutique-brand-link" aria-label={copy.navigation.storeHome}>
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.name} className="boutique-brand__logo" />
            ) : (
              <span className="boutique-brand__title">{branding.name}</span>
            )}
          </a>
        </div>

        <nav className="boutique-nav" aria-label={copy.navigation.primary}>
          <ul className="boutique-nav__list" role="list">
            <li>
              <a href={links.home} className="boutique-nav__link">
                {copy.navigation.home}
              </a>
            </li>
            <li>
              <a href={links.products} className="boutique-nav__link">
                {copy.navigation.products}
              </a>
            </li>
            {navigationCategories.slice(0, 5).map((cat) => (
              <li key={cat.slug}>
                <a href={cat.href} className="boutique-nav__link">
                  {cat.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="boutique-header__actions">
          {settings.showSearch ? (
            <a href={links.search} className="boutique-action-link" aria-label={copy.navigation.search}>
              {copy.search.heading}
            </a>
          ) : null}

          {localeLinks.length > 1 ? (
            <nav className="boutique-locales" aria-label={copy.navigation.localeLabel}>
              {localeLinks.map((item) => (
                <a
                  key={item.locale}
                  href={item.href}
                  className={`boutique-locale-link ${item.current ? 'boutique-locale-link--active' : ''}`}
                  lang={item.locale}
                  hrefLang={item.locale}
                  aria-current={item.current ? 'true' : undefined}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function BoutiqueFooter({ context }: { context: ThemeContext }) {
  const { branding, copy, links, navigationCategories, settings } = context;
  const columns = Math.max(1, Math.min(settings.footerColumns, 4));

  return (
    <footer className="boutique-footer">
      <div className="boutique-footer__inner" data-columns={columns}>
        <div className="boutique-footer__col">
          <h3 className="boutique-footer__title">{branding.name}</h3>
          <p className="boutique-footer__tagline">{copy.footer.heading}</p>
        </div>

        {columns > 1 ? (
          <nav className="boutique-footer__col" aria-label={copy.navigation.products}>
            <h4 className="boutique-footer__heading">{copy.navigation.products}</h4>
            <ul className="boutique-footer__list" role="list">
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
          <nav className="boutique-footer__col" aria-label={copy.navigation.categories}>
            <h4 className="boutique-footer__heading">{copy.navigation.categories}</h4>
            <ul className="boutique-footer__list" role="list">
              {navigationCategories.slice(0, 4).map((cat) => (
                <li key={cat.slug}>
                  <a href={cat.href}>{cat.name}</a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>

      <div className="boutique-footer__bottom">
        <p className="boutique-footer__legal">
          {format(copy.footer.rights, { year: new Date().getFullYear(), store: branding.name })}
        </p>
      </div>
    </footer>
  );
}
