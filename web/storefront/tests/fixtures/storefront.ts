import type {
  CategoryNode,
  ProductDetail,
  ProductListItem,
  ProductPage,
  StoreBootstrap,
  StoreTheme
} from '../../src/lib/contracts';

/**
 * Fixtures of the public storefront contract.
 *
 * These are shaped like the JSON `GET /v1/storefront/*` returns. They are written here
 * rather than imported from another repository: the Repository Independence Rule
 * forbids consuming Core's test data, and a fixture that drifts from the published
 * contract is a bug this repository must be able to catch on its own.
 *
 * Several fixtures deliberately carry extra, internal-looking fields — a wholesale
 * price, a supplier, a platform fee. The public API does not return them; they exist so
 * the privacy tests can prove that even if such a field appeared in a payload, no
 * rendered page would contain it.
 */

export const HOST_A = 'store-a.example';
export const HOST_B = 'store-b.example';

export const themeA: StoreTheme = {
  key: 'matjero-default',
  version: '1.0.0',
  configuration: {
    logo: '',
    colors: { primary: '#0f766e', secondary: '#0d9488', background: '#ffffff', text: '#0f172a' },
    typography: { font_family: 'Inter, system-ui, sans-serif', base_size: 'medium' },
    announcement_bar: { enabled: true, text: 'Free delivery over 500', background_color: '#0f766e', text_color: '#ffffff' },
    header: { layout: 'classic', show_search: true },
    footer: { columns: 3 },
    navigation: { style: 'horizontal' },
    hero: {
      title: 'Everything for the modern home',
      subtitle: 'Curated lighting, furniture and decor.',
      image_url: 'https://cdn.example/hero-a.jpg',
      cta_label: 'Shop lighting',
      cta_url: 'https://store-a.example/en/categories/lighting'
    },
    homepage_sections: [
      { type: 'featured', title: 'Featured' },
      { type: 'category_grid', title: 'Browse categories' }
    ],
    product_card_layout: 'detailed',
    category_layout: 'grid',
    spacing: 'comfortable'
  },
  configuration_revision: 4
};

export const storeA: StoreBootstrap = {
  store_code: 'store-a',
  store_name: 'Store A',
  domain: HOST_A,
  market: 'EG',
  currency: { code: 'EGP', symbol: 'E£', minor_unit: 2 },
  timezone: 'Africa/Cairo',
  default_locale: 'ar',
  supported_locales: ['ar', 'en'],
  settings: { tagline: 'Store A tagline' },
  theme: themeA
};

export const storeB: StoreBootstrap = {
  store_code: 'store-b',
  store_name: 'Store B',
  domain: HOST_B,
  market: 'SA',
  currency: { code: 'SAR', symbol: 'SR', minor_unit: 2 },
  timezone: 'Asia/Riyadh',
  default_locale: 'en',
  supported_locales: ['en', 'ar'],
  settings: {},
  theme: {
    key: 'matjero-default',
    version: '1.0.0',
    configuration: {
      colors: { primary: '#7c3aed', background: '#ffffff', text: '#111827' },
      header: { layout: 'minimal', show_search: false },
      footer: { columns: 1 },
      homepage_sections: [{ type: 'product_carousel', title: 'Store B picks' }],
      product_card_layout: 'compact',
      spacing: 'compact'
    },
    configuration_revision: 2
  }
};

export const categoriesA: CategoryNode[] = [
  { slug: 'lighting', name: 'Lighting', description: 'Lamps and fixtures', product_count: 12 },
  { slug: 'desk-lamps', name: 'Desk lamps', parent_slug: 'lighting', product_count: 5 },
  { slug: 'furniture', name: 'Furniture', product_count: 8 }
];

export const categoriesB: CategoryNode[] = [
  { slug: 'outdoor', name: 'Outdoor', description: 'Garden and patio', product_count: 3 }
];

export const productItemA: ProductListItem = {
  slug: 'aurora-desk-lamp',
  name: 'Aurora desk lamp',
  summary: 'A warm, dimmable desk lamp.',
  price: { amount_minor: 24900, currency: 'EGP' },
  image: { uri: 'https://cdn.example/aurora.jpg', alt_text: 'Aurora desk lamp on a desk' },
  category: { slug: 'lighting', name: 'Lighting' },
  availability: 'in_stock',
  variant_count: 2
};

export const productItemAOut: ProductListItem = {
  slug: 'halo-floor-lamp',
  name: 'Halo floor lamp',
  price: { amount_minor: 89900, currency: 'EGP' },
  availability: 'out_of_stock',
  variant_count: 0
};

export const productItemB: ProductListItem = {
  slug: 'patio-bench',
  name: 'Patio bench',
  summary: 'Weatherproof bench for two.',
  price: { amount_minor: 129900, currency: 'SAR' },
  image: { uri: 'https://cdn.example/bench.jpg' },
  availability: 'in_stock',
  variant_count: 1
};

export const productPageA: ProductPage = {
  items: [productItemA, productItemAOut],
  pagination: { total: 2, limit: 24, offset: 0 }
};

export const productPageB: ProductPage = {
  items: [productItemB],
  pagination: { total: 1, limit: 24, offset: 0 }
};

export const productDetailA: ProductDetail = {
  slug: 'aurora-desk-lamp',
  name: 'Aurora desk lamp',
  description: 'A warm, dimmable desk lamp with a brushed brass finish.',
  price: { amount_minor: 24900, currency: 'EGP' },
  availability: 'in_stock',
  images: [
    { uri: 'https://cdn.example/aurora.jpg', alt_text: 'Aurora desk lamp on a desk' },
    { uri: 'https://cdn.example/aurora-detail.jpg' }
  ],
  categories: [{ slug: 'lighting', name: 'Lighting' }],
  variants: [
    { code: 'brass', availability: 'in_stock', skus: [{ id: 'sku-aurora-brass', availability: 'in_stock' }] },
    { code: 'graphite', availability: 'out_of_stock', skus: [] }
  ]
};

export const productDetailB: ProductDetail = {
  slug: 'patio-bench',
  name: 'Patio bench',
  description: 'Weatherproof bench for two.',
  price: { amount_minor: 129900, currency: 'SAR' },
  availability: 'in_stock',
  images: [],
  categories: [{ slug: 'outdoor', name: 'Outdoor' }],
  variants: []
};

/**
 * A payload salted with fields the public contract does not define.
 *
 * Used to prove the rendering path cannot surface a wholesale price, a supplier, a
 * platform fee or an internal identifier even when one is present in the JSON.
 */
export const productDetailWithInternals = {
  ...productDetailA,
  wholesale_price: { amount_minor: 11000, currency: 'EGP' },
  wholesale_price_minor: 11000,
  supplier_id: 'b6f1a2c4-1111-2222-3333-444455556666',
  supplier_name: 'Northwind Supply Co',
  supplier_email: 'ops@northwind-supply.example',
  supplier_phone: '+20 100 000 0000',
  platform_fee_minor: 2400,
  margin_minor: 11500,
  fulfillment_provider: 'internal-3pl-eu-1',
  internal_notes: 'reorder from warehouse 7'
} as unknown as ProductDetail;

export const productItemWithInternals = {
  ...productItemA,
  wholesale_price_minor: 11000,
  supplier_id: 'b6f1a2c4-1111-2222-3333-444455556666',
  supplier_name: 'Northwind Supply Co',
  platform_fee_minor: 2400
} as unknown as ProductListItem;
