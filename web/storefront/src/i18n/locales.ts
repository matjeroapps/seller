/**
 * Locale foundation.
 *
 * The storefront serves the locales the resolved market supports. `en` and `ar` are
 * the platform baseline; a store's own supported set is intersected with this list
 * so a locale the store does not publish is never routed to.
 */
export const locales = ['ar', 'en'] as const;
export type Locale = (typeof locales)[number];

export type Direction = 'rtl' | 'ltr';

export function directionFor(locale: Locale): Direction {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

/**
 * Storefront dictionaries.
 *
 * These are the customer-visible strings the storefront owns: navigation, labels,
 * empty states and error copy. Catalog content — product and category names,
 * descriptions, summaries — is never translated here. The storefront API already
 * returns it in the requested locale, and re-translating it in the frontend would
 * duplicate a Core responsibility and drift from it.
 *
 * Both locales are declared against one type, so a missing key is a type error
 * rather than an English string leaking into an Arabic page.
 */

export type Dictionary = {
  document: {
    title: string;
  };
  navigation: {
    skipToContent: string;
    primary: string;
    breadcrumb: string;
    home: string;
    products: string;
    categories: string;
    search: string;
    menu: string;
    storeHome: string;
    localeLabel: string;
    localeNames: Record<Locale, string>;
  };
  home: {
    featured: string;
    categories: string;
    newArrivals: string;
    shopNow: string;
    browseAll: string;
  };
  products: {
    title: string;
    resultCount: string;
    empty: string;
    emptyHint: string;
    viewDetails: string;
    productImage: string;
    noImage: string;
  };
  availability: {
    label: string;
    in_stock: string;
    out_of_stock: string;
  };
  filters: {
    heading: string;
    availability: string;
    any: string;
    apply: string;
    clear: string;
    sort: string;
    sortOptions: {
      newest: string;
      price_asc: string;
      price_desc: string;
      name_asc: string;
    };
  };
  pagination: {
    label: string;
    previous: string;
    next: string;
    status: string;
  };
  category: {
    heading: string;
    productCount: string;
    empty: string;
    all: string;
    parent: string;
  };
  product: {
    description: string;
    variants: string;
    variantLabel: string;
    gallery: string;
    inCategories: string;
    priceLabel: string;
  };
  search: {
    heading: string;
    label: string;
    placeholder: string;
    submit: string;
    resultsFor: string;
    empty: string;
    emptyHint: string;
    prompt: string;
  };
  notFound: {
    heading: string;
    body: string;
    backHome: string;
  };
  unavailable: {
    heading: string;
    body: string;
  };
  error: {
    heading: string;
    body: string;
    retry: string;
  };
  footer: {
    heading: string;
    rights: string;
  };
  cart: {
    title: string;
    addToCart: string;
    added: string;
    viewCart: string;
    quantity: string;
    remove: string;
    subtotal: string;
    checkout: string;
    empty: string;
    continueShopping: string;
    unitPrice: string;
    lineTotal: string;
  };
  checkout: {
    title: string;
    recipientName: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    region: string;
    postalCode: string;
    countryCode: string;
    contactEmail: string;
    submit: string;
    submitting: string;
  };
  order: {
    title: string;
    number: string;
    status: string;
    statusPending: string;
    statusCancelled: string;
    statusConfirmed: string;
    cancelOrder: string;
    cancelling: string;
    items: string;
    totals: string;
    confirmationDeadline: string;
    created: string;
  };
};

const en: Dictionary = {
  document: { title: 'Storefront' },
  navigation: {
    skipToContent: 'Skip to main content',
    primary: 'Primary',
    breadcrumb: 'Breadcrumb',
    home: 'Home',
    products: 'Products',
    categories: 'Categories',
    search: 'Search',
    menu: 'Menu',
    storeHome: 'Store home',
    localeLabel: 'Language',
    localeNames: { en: 'English', ar: 'العربية' }
  },
  home: {
    featured: 'Featured products',
    categories: 'Shop by category',
    newArrivals: 'New arrivals',
    shopNow: 'Shop now',
    browseAll: 'Browse all products'
  },
  products: {
    title: 'Products',
    resultCount: '{count} products',
    empty: 'No products yet',
    emptyHint: 'This catalog has nothing to show right now. Please check back soon.',
    viewDetails: 'View details',
    productImage: 'Product image',
    noImage: 'No image available'
  },
  availability: {
    label: 'Availability',
    in_stock: 'In stock',
    out_of_stock: 'Out of stock'
  },
  filters: {
    heading: 'Refine',
    availability: 'Availability',
    any: 'Any',
    apply: 'Apply',
    clear: 'Clear',
    sort: 'Sort by',
    sortOptions: {
      newest: 'Newest',
      price_asc: 'Price: low to high',
      price_desc: 'Price: high to low',
      name_asc: 'Name: A to Z'
    }
  },
  pagination: {
    label: 'Pagination',
    previous: 'Previous',
    next: 'Next',
    status: 'Page {page} of {pages}'
  },
  category: {
    heading: 'Category',
    productCount: '{count} products',
    empty: 'This category has no products yet',
    all: 'All categories',
    parent: 'Part of {name}'
  },
  product: {
    description: 'Description',
    variants: 'Options',
    variantLabel: 'Option',
    gallery: 'Product gallery',
    inCategories: 'Categories',
    priceLabel: 'Price'
  },
  search: {
    heading: 'Search',
    label: 'Search products',
    placeholder: 'Search products',
    submit: 'Search',
    resultsFor: 'Results for “{query}”',
    empty: 'No results found',
    emptyHint: 'Try a different word or fewer filters.',
    prompt: 'Enter a word to search this store.'
  },
  notFound: {
    heading: 'Page not found',
    body: 'The page you were looking for does not exist.',
    backHome: 'Back to home'
  },
  unavailable: {
    heading: 'Store unavailable',
    body: 'This store is not available right now.'
  },
  error: {
    heading: 'Something went wrong',
    body: 'We could not load this page. Please try again.',
    retry: 'Try again'
  },
  footer: {
    heading: 'Store information',
    rights: '© {year} {store}. All rights reserved.'
  },
  cart: {
    title: 'Cart',
    addToCart: 'Add to Cart',
    added: 'Added to cart',
    viewCart: 'View Cart',
    quantity: 'Quantity',
    remove: 'Remove',
    subtotal: 'Subtotal',
    checkout: 'Proceed to Checkout',
    empty: 'Your cart is empty',
    continueShopping: 'Continue Shopping',
    unitPrice: 'Unit Price',
    lineTotal: 'Total'
  },
  checkout: {
    title: 'Checkout',
    recipientName: 'Recipient Name',
    addressLine1: 'Address Line 1',
    addressLine2: 'Address Line 2 (Optional)',
    city: 'City',
    region: 'Region / State',
    postalCode: 'Postal Code',
    countryCode: 'Country Code',
    contactEmail: 'Email Address',
    submit: 'Place Order',
    submitting: 'Processing...'
  },
  order: {
    title: 'Order Details',
    number: 'Order #{number}',
    status: 'Status',
    statusPending: 'Pending',
    statusCancelled: 'Cancelled',
    statusConfirmed: 'Confirmed',
    cancelOrder: 'Cancel Order',
    cancelling: 'Cancelling...',
    items: 'Items',
    totals: 'Totals',
    confirmationDeadline: 'Confirmation Deadline',
    created: 'Order Date'
  }
};

const ar: Dictionary = {
  document: { title: 'المتجر' },
  navigation: {
    skipToContent: 'تجاوز إلى المحتوى الرئيسي',
    primary: 'التنقل الرئيسي',
    breadcrumb: 'مسار التنقل',
    home: 'الرئيسية',
    products: 'المنتجات',
    categories: 'التصنيفات',
    search: 'البحث',
    menu: 'القائمة',
    storeHome: 'الصفحة الرئيسية للمتجر',
    localeLabel: 'اللغة',
    localeNames: { en: 'English', ar: 'العربية' }
  },
  home: {
    featured: 'منتجات مختارة',
    categories: 'تسوق حسب التصنيف',
    newArrivals: 'وصل حديثاً',
    shopNow: 'تسوق الآن',
    browseAll: 'تصفح كل المنتجات'
  },
  products: {
    title: 'المنتجات',
    resultCount: '{count} منتج',
    empty: 'لا توجد منتجات بعد',
    emptyHint: 'لا يوجد ما يمكن عرضه حالياً. يرجى العودة قريباً.',
    viewDetails: 'عرض التفاصيل',
    productImage: 'صورة المنتج',
    noImage: 'لا تتوفر صورة'
  },
  availability: {
    label: 'التوفر',
    in_stock: 'متوفر',
    out_of_stock: 'غير متوفر'
  },
  filters: {
    heading: 'تصفية',
    availability: 'التوفر',
    any: 'الكل',
    apply: 'تطبيق',
    clear: 'إزالة',
    sort: 'الترتيب',
    sortOptions: {
      newest: 'الأحدث',
      price_asc: 'السعر: من الأقل للأعلى',
      price_desc: 'السعر: من الأعلى للأقل',
      name_asc: 'الاسم: أ إلى ي'
    }
  },
  pagination: {
    label: 'التنقل بين الصفحات',
    previous: 'السابق',
    next: 'التالي',
    status: 'صفحة {page} من {pages}'
  },
  category: {
    heading: 'التصنيف',
    productCount: '{count} منتج',
    empty: 'لا توجد منتجات في هذا التصنيف بعد',
    all: 'كل التصنيفات',
    parent: 'ضمن {name}'
  },
  product: {
    description: 'الوصف',
    variants: 'الخيارات',
    variantLabel: 'خيار',
    gallery: 'معرض صور المنتج',
    inCategories: 'التصنيفات',
    priceLabel: 'السعر'
  },
  search: {
    heading: 'البحث',
    label: 'ابحث في المنتجات',
    placeholder: 'ابحث في المنتجات',
    submit: 'بحث',
    resultsFor: 'نتائج البحث عن «{query}»',
    empty: 'لا توجد نتائج',
    emptyHint: 'جرب كلمة أخرى أو قلل عدد المرشحات.',
    prompt: 'اكتب كلمة للبحث في هذا المتجر.'
  },
  notFound: {
    heading: 'الصفحة غير موجودة',
    body: 'الصفحة التي تبحث عنها غير موجودة.',
    backHome: 'العودة إلى الرئيسية'
  },
  unavailable: {
    heading: 'المتجر غير متاح',
    body: 'هذا المتجر غير متاح في الوقت الحالي.'
  },
  error: {
    heading: 'حدث خطأ ما',
    body: 'لم نتمكن من تحميل هذه الصفحة. يرجى المحاولة مرة أخرى.',
    retry: 'إعادة المحاولة'
  },
  footer: {
    heading: 'معلومات المتجر',
    rights: '© {year} {store}. جميع الحقوق محفوظة.'
  },
  cart: {
    title: 'سلة التسوق',
    addToCart: 'إضافة إلى السلة',
    added: 'تمت الإضافة إلى السلة',
    viewCart: 'عرض السلة',
    quantity: 'الكمية',
    remove: 'إزالة',
    subtotal: 'المجموع الفرعي',
    checkout: 'إتمام الطلب',
    empty: 'سلة التسوق فارغة',
    continueShopping: 'متابعة التسوق',
    unitPrice: 'سعر الوحدة',
    lineTotal: 'الإجمالي'
  },
  checkout: {
    title: 'إتمام الطلب',
    recipientName: 'اسم المستلم',
    addressLine1: 'عنوان الشارع',
    addressLine2: 'عنوان إضافي (اختياري)',
    city: 'المدينة',
    region: 'المنطقة / المحافظة',
    postalCode: 'الرمز البريدي',
    countryCode: 'رمز الدولة',
    contactEmail: 'البريد الإلكتروني',
    submit: 'تأكيد الطلب',
    submitting: 'جاري معالجة الطلب...'
  },
  order: {
    title: 'تفاصيل الطلب',
    number: 'طلب رقم {number}',
    status: 'الحالة',
    statusPending: 'قيد الانتظار',
    statusCancelled: 'ملغي',
    statusConfirmed: 'مؤكد',
    cancelOrder: 'إلغاء الطلب',
    cancelling: 'جاري الإلغاء...',
    items: 'المنتجات',
    totals: 'الإجمالي',
    confirmationDeadline: 'الموعد النهائي للتأكيد',
    created: 'تاريخ الطلب'
  }
};

export const dictionaries: Record<Locale, Dictionary> = { en, ar };

export function dictionaryFor(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/**
 * format substitutes `{name}` placeholders.
 *
 * Values are interpolated as plain text into JSX children, never into markup, so a
 * value cannot introduce an element or an attribute.
 */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match
  );
}
