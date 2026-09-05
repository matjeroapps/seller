import type { Dictionary, Locale } from '../i18n/locales';
import type { PublicCurrency, SortOrder } from '../lib/contracts';

/**
 * The theme contract.
 *
 * A theme receives view models and renders them. It never fetches, never derives a
 * price, never computes availability and never learns which service produced its
 * data. That is what makes a theme swap a presentation change: the page loaders
 * above this boundary are identical for every theme.
 *
 * The types below are the whole vocabulary a theme is given.
 */

/** Design tokens a theme applies to the document. Always fully populated. */
export type ThemeTokens = {
  colorPrimary: string;
  colorSecondary: string;
  colorBackground: string;
  colorText: string;
  fontBody: string;
  baseSize: 'small' | 'medium' | 'large';
  spacing: 'comfortable' | 'compact';
};

export type AnnouncementBar = {
  text: string;
  backgroundColor: string;
  textColor: string;
};

export type Hero = {
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaUrl: string;
};

export type HomepageSectionKind = 'featured' | 'category_grid' | 'product_carousel';

export type HomepageSection = {
  kind: HomepageSectionKind;
  title: string;
};

/**
 * The normalized, validated presentation settings of a store.
 *
 * Every field is present and safe to render. Missing, malformed or unsafe values
 * from the published configuration were replaced with defaults before this object
 * was built, so a theme performs no validation of its own.
 */
export type ThemeSettings = {
  key: string;
  version: string;
  revision: number;
  tokens: ThemeTokens;
  logoUrl: string;
  faviconUrl: string;
  announcement: AnnouncementBar | null;
  headerLayout: 'minimal' | 'centered' | 'classic';
  showSearch: boolean;
  navigationStyle: 'horizontal' | 'dropdown';
  footerColumns: number;
  hero: Hero | null;
  homepageSections: HomepageSection[];
  productCardLayout: 'compact' | 'detailed';
  categoryLayout: 'grid' | 'list';
};

/** A price already reduced to a display string plus its raw parts. */
export type DisplayPrice = {
  formatted: string;
  amountMinor: number;
  currency: string;
};

export type StoreBranding = {
  name: string;
  code: string;
  logoUrl: string;
};

/** A link inside the storefront. Locale prefix already applied. */
export type StoreLink = {
  href: string;
  label: string;
};

export type ProductCardModel = {
  slug: string;
  name: string;
  summary: string;
  price: DisplayPrice;
  image: { uri: string; alt: string } | null;
  category: { slug: string; name: string } | null;
  available: boolean;
  availabilityLabel: string;
  href: string;
};

export type CategoryCardModel = {
  slug: string;
  name: string;
  description: string;
  productCount: number;
  href: string;
};

export type PaginationModel = {
  page: number;
  pages: number;
  previousHref: string | null;
  nextHref: string | null;
  total: number;
};

export type SortOption = {
  value: SortOrder;
  label: string;
  selected: boolean;
};

export type AvailabilityOption = {
  value: '' | 'in_stock' | 'out_of_stock';
  label: string;
  selected: boolean;
};

/** Everything shared by every themed page. */
export type ThemeContext = {
  locale: Locale;
  direction: 'ltr' | 'rtl';
  copy: Dictionary;
  settings: ThemeSettings;
  branding: StoreBranding;
  currency: PublicCurrency;
  /** Top-level categories, for navigation. */
  navigationCategories: CategoryCardModel[];
  links: {
    home: string;
    products: string;
    categories: string;
    search: string;
  };
  /** The equivalent path in each supported locale, for the locale switch. */
  localeLinks: { locale: Locale; label: string; href: string; current: boolean }[];
};

export type HomeViewModel = {
  hero: Hero | null;
  sections: {
    kind: HomepageSectionKind;
    title: string;
    products: ProductCardModel[];
    categories: CategoryCardModel[];
  }[];
  browseAllHref: string;
};

export type ProductListViewModel = {
  heading: string;
  products: ProductCardModel[];
  pagination: PaginationModel;
  sortOptions: SortOption[];
  availabilityOptions: AvailabilityOption[];
  /** Where the filter form submits. Query state stays in the URL. */
  formAction: string;
  keyword: string;
};

export type CategoryViewModel = {
  category: CategoryCardModel;
  parentName: string;
  list: ProductListViewModel;
};

export type ProductVariantModel = {
  code: string;
  available: boolean;
  availabilityLabel: string;
  skuCount: number;
  skuId?: string;
};

export type ProductDetailViewModel = {
  name: string;
  description: string;
  price: DisplayPrice;
  available: boolean;
  availabilityLabel: string;
  images: { uri: string; alt: string }[];
  categories: StoreLink[];
  variants: ProductVariantModel[];
  defaultSkuId?: string;
};

export type SearchViewModel = {
  keyword: string;
  list: ProductListViewModel;
};

/**
 * The component set a theme registers.
 *
 * Each entry is a plain React component receiving a view model. None of them is
 * async and none of them may fetch.
 */
export type ThemeComponents = {
  Layout: React.ComponentType<{ context: ThemeContext; children: React.ReactNode }>;
  Home: React.ComponentType<{ context: ThemeContext; model: HomeViewModel }>;
  ProductList: React.ComponentType<{ context: ThemeContext; model: ProductListViewModel }>;
  ProductDetail: React.ComponentType<{ context: ThemeContext; model: ProductDetailViewModel }>;
  Category: React.ComponentType<{ context: ThemeContext; model: CategoryViewModel }>;
  SearchResults: React.ComponentType<{ context: ThemeContext; model: SearchViewModel }>;
  NotFound: React.ComponentType<{ context: ThemeContext }>;
  Unavailable: React.ComponentType<{ locale: Locale; copy: Dictionary }>;
  ErrorState: React.ComponentType<{ locale: Locale; copy: Dictionary; reset?: () => void }>;
};

/** A registered theme: an identity, the versions it serves, and its components. */
export type ThemeDefinition = {
  key: string;
  /**
   * Versions this component set is compatible with. A store pinned to a version
   * outside this list is not rendered by this theme, because pretending an
   * unknown version is compatible is how a storefront silently renders wrong.
   */
  versions: string[];
  components: ThemeComponents;
};

/**
 * Re-exported so a theme imports one module.
 *
 * Deliberately only these. Raw payload types are absent: a theme never receives one, and
 * not being able to name one is what keeps that true.
 */
export type { Dictionary, Locale, PublicCurrency, SortOrder };
