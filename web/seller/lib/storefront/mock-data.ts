export type StorefrontLocale = 'en' | 'ar';
export type StorefrontDirection = 'ltr' | 'rtl';

export type StorefrontProduct = {
  id: string;
  name: string;
  category: string;
  price: string;
  imageLabel: string;
  badge?: string;
  available: boolean;
};

export type StorefrontCategory = {
  id: string;
  name: string;
  count: number;
};

export type StorefrontCopy = {
  languageName: string;
  nav: {
    primary: string;
    home: string;
    products: string;
    search: string;
    language: string;
    account: string;
    cart: string;
    menu: string;
  };
  home: {
    eyebrow: string;
    title: string;
    body: string;
    cta: string;
    secondary: string;
    featured: string;
    categories: string;
    promotions: string;
    promotionTitle: string;
    promotionBody: string;
  };
  products: {
    title: string;
    body: string;
    sort: string;
    sortOptions: {
      featured: string;
      priceAsc: string;
      priceDesc: string;
    };
    filter: string;
    availability: string;
    inStock: string;
    outOfStock: string;
    all: string;
    pagination: string;
    pageStatus: string;
    previous: string;
    next: string;
    mockCount: string;
    itemCount: string;
    details: string;
  };
  search: {
    title: string;
    body: string;
    label: string;
    placeholder: string;
    submit: string;
    emptyTitle: string;
    emptyBody: string;
    noResultsTitle: string;
    noResultsBody: string;
    suggestions: string;
  };
  footer: {
    tagline: string;
    rights: string;
  };
};

export type StorefrontData = {
  slug: string;
  name: string;
  logo: string;
  copy: Record<StorefrontLocale, StorefrontCopy>;
  categories: Record<StorefrontLocale, StorefrontCategory[]>;
  products: Record<StorefrontLocale, StorefrontProduct[]>;
  promotionCode: string;
};

export const storefrontLocales: StorefrontLocale[] = ['en', 'ar'];

export function directionForStorefront(locale: StorefrontLocale): StorefrontDirection {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function normalizeLocale(value?: string): StorefrontLocale {
  return value === 'ar' ? 'ar' : 'en';
}

const store: StorefrontData = {
  slug: 'modern-home',
  name: 'Modern Home',
  logo: 'MH',
  promotionCode: 'HOME15',
  copy: {
    en: {
      languageName: 'English',
      nav: {
        primary: 'Store navigation',
        home: 'Home',
        products: 'Products',
        search: 'Search',
        language: 'Language',
        account: 'Customer account',
        cart: 'Cart',
        menu: 'Menu'
      },
      home: {
        eyebrow: 'Curated marketplace storefront',
        title: 'Everything for a calmer, better organized home',
        body: 'A production-ready storefront foundation for browsing featured products, categories, promotions, search, and commerce-ready actions.',
        cta: 'Shop products',
        secondary: 'Search catalog',
        featured: 'Featured products',
        categories: 'Shop by category',
        promotions: 'Today in store',
        promotionTitle: 'Opening week bundle',
        promotionBody: 'Use the storefront foundation to highlight campaign-ready offers without connecting payment, order, or inventory systems yet.'
      },
      products: {
        title: 'Products',
        body: 'Browse mock catalog items with layout-ready sorting, filtering, pagination, and product-card patterns.',
        sort: 'Sort by',
        sortOptions: {
          featured: 'Featured',
          priceAsc: 'Price ascending',
          priceDesc: 'Price descending'
        },
        filter: 'Filters',
        availability: 'Availability',
        inStock: 'In stock',
        outOfStock: 'Out of stock',
        all: 'All products',
        pagination: 'Pagination',
        pageStatus: 'Page 1 of 3',
        previous: 'Previous',
        next: 'Next',
        mockCount: '{count} mock products',
        itemCount: '{count} items',
        details: 'View details'
      },
      search: {
        title: 'Search the store',
        body: 'A customer search foundation with explicit empty, no-results, and suggestion states.',
        label: 'Search query',
        placeholder: 'Search lighting, chairs, storage...',
        submit: 'Search',
        emptyTitle: 'Start with a product, category, or style',
        emptyBody: 'Search is wired as a UX placeholder only. It reads the URL query and filters mock products locally.',
        noResultsTitle: 'No matching products',
        noResultsBody: 'Try a broader product name or browse the suggested categories below.',
        suggestions: 'Suggested searches'
      },
      footer: {
        tagline: 'Commerce-ready storefront patterns for MatjerHub sellers.',
        rights: 'Customer storefront foundation'
      }
    },
    ar: {
      languageName: 'العربية',
      nav: {
        primary: 'تنقل المتجر',
        home: 'الرئيسية',
        products: 'المنتجات',
        search: 'البحث',
        language: 'اللغة',
        account: 'حساب العميل',
        cart: 'السلة',
        menu: 'القائمة'
      },
      home: {
        eyebrow: 'واجهة متجر سوقية منظمة',
        title: 'كل ما يجعل المنزل أهدأ وأسهل في التنظيم',
        body: 'أساس واجهة متجر جاهز للإنتاج يعرض المنتجات المميزة، التصنيفات، العروض، البحث، وأنماط التجارة بدون تكاملات خلفية.',
        cta: 'تصفح المنتجات',
        secondary: 'ابحث في المتجر',
        featured: 'منتجات مميزة',
        categories: 'تسوق حسب التصنيف',
        promotions: 'اليوم في المتجر',
        promotionTitle: 'عرض أسبوع الافتتاح',
        promotionBody: 'استخدم هذا الأساس لعرض حملات وعروض جاهزة دون ربط المدفوعات أو الطلبات أو المخزون الآن.'
      },
      products: {
        title: 'المنتجات',
        body: 'تصفح عناصر تجريبية مع أنماط جاهزة للفرز، التصفية، الصفحات، وبطاقات المنتجات.',
        sort: 'ترتيب حسب',
        sortOptions: {
          featured: 'المميز',
          priceAsc: 'السعر من الأقل',
          priceDesc: 'السعر من الأعلى'
        },
        filter: 'التصفية',
        availability: 'التوفر',
        inStock: 'متوفر',
        outOfStock: 'غير متوفر',
        all: 'كل المنتجات',
        pagination: 'التنقل بين الصفحات',
        pageStatus: 'الصفحة 1 من 3',
        previous: 'السابق',
        next: 'التالي',
        mockCount: '{count} منتجات تجريبية',
        itemCount: '{count} عناصر',
        details: 'عرض التفاصيل'
      },
      search: {
        title: 'ابحث في المتجر',
        body: 'أساس تجربة بحث للعميل مع حالات فارغة وحالات بلا نتائج واقتراحات واضحة.',
        label: 'عبارة البحث',
        placeholder: 'ابحث عن إضاءة، كراسي، تخزين...',
        submit: 'بحث',
        emptyTitle: 'ابدأ باسم منتج أو تصنيف أو نمط',
        emptyBody: 'البحث هنا أساس تجربة فقط. يقرأ عبارة الرابط ويفلتر المنتجات التجريبية محليا.',
        noResultsTitle: 'لا توجد منتجات مطابقة',
        noResultsBody: 'جرب عبارة أوسع أو تصفح التصنيفات المقترحة أدناه.',
        suggestions: 'اقتراحات بحث'
      },
      footer: {
        tagline: 'أنماط واجهة متجر جاهزة للتجارة لبائعي MatjerHub.',
        rights: 'أساس واجهة متجر العملاء'
      }
    }
  },
  categories: {
    en: [
      { id: 'lighting', name: 'Lighting', count: 18 },
      { id: 'seating', name: 'Seating', count: 12 },
      { id: 'storage', name: 'Storage', count: 9 }
    ],
    ar: [
      { id: 'lighting', name: 'الإضاءة', count: 18 },
      { id: 'seating', name: 'المقاعد', count: 12 },
      { id: 'storage', name: 'التخزين', count: 9 }
    ]
  },
  products: {
    en: [
      { id: 'aurora-lamp', name: 'Aurora desk lamp', category: 'Lighting', price: 'EGP 249', imageLabel: 'Warm brass lamp', badge: 'Featured', available: true },
      { id: 'linen-chair', name: 'Linen lounge chair', category: 'Seating', price: 'EGP 1,850', imageLabel: 'Soft lounge chair', available: true },
      { id: 'oak-shelf', name: 'Modular oak shelf', category: 'Storage', price: 'EGP 980', imageLabel: 'Oak storage shelf', badge: 'New', available: false },
      { id: 'woven-basket', name: 'Woven basket set', category: 'Storage', price: 'EGP 320', imageLabel: 'Natural baskets', available: true },
      { id: 'floor-lantern', name: 'Floor lantern', category: 'Lighting', price: 'EGP 640', imageLabel: 'Tall floor lantern', available: true },
      { id: 'compact-stool', name: 'Compact stool', category: 'Seating', price: 'EGP 410', imageLabel: 'Wooden stool', available: false }
    ],
    ar: [
      { id: 'aurora-lamp', name: 'مصباح مكتب أورورا', category: 'الإضاءة', price: '249 ج.م', imageLabel: 'مصباح نحاسي دافئ', badge: 'مميز', available: true },
      { id: 'linen-chair', name: 'كرسي استرخاء كتاني', category: 'المقاعد', price: '1,850 ج.م', imageLabel: 'كرسي استرخاء ناعم', available: true },
      { id: 'oak-shelf', name: 'رف بلوط مرن', category: 'التخزين', price: '980 ج.م', imageLabel: 'رف تخزين بلوط', badge: 'جديد', available: false },
      { id: 'woven-basket', name: 'طقم سلال منسوجة', category: 'التخزين', price: '320 ج.م', imageLabel: 'سلال طبيعية', available: true },
      { id: 'floor-lantern', name: 'فانوس أرضي', category: 'الإضاءة', price: '640 ج.م', imageLabel: 'فانوس أرضي طويل', available: true },
      { id: 'compact-stool', name: 'مقعد صغير', category: 'المقاعد', price: '410 ج.م', imageLabel: 'مقعد خشبي', available: false }
    ]
  }
};

export function getStorefront(slug: string): StorefrontData {
  return {
    ...store,
    slug,
    name: slug
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || store.name
  };
}

export function productStructuredData(storefront: StorefrontData, product: StorefrontProduct) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    brand: storefront.name,
    description: product.imageLabel,
    offers: {
      '@type': 'Offer',
      availability: product.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      priceCurrency: 'EGP'
    }
  };
}

export function storeStructuredData(storefront: StorefrontData) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: storefront.name,
    url: `/store/${storefront.slug}`
  };
}
