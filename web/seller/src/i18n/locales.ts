export const locales = ['ar', 'en'] as const;
export type Locale = (typeof locales)[number];

export const messages: Record<Locale, Record<string, string>> = {
  ar: {
    appName: 'لوحة البائع',
    status: 'جاهز للبناء',
    dashboard: 'الرئيسية',
    themeCatalog: 'كتالوج الثيمات',
    storeThemeManagement: 'إدارة ثيم المتجر',
    activeStore: 'المتجر الحالي',

    // Auth
    signIn: 'تسجيل الدخول عبر ZITADEL',
    signOut: 'تسجيل الخروج',
    authenticating: 'جاري إكمال المصادقة...',
    checkingAuth: 'جاري التحقق من الجلسة...',
    loginPrompt: 'يرجى تسجيل الدخول بحساب ZITADEL لإدارة متجرك وثيماتك.',
    accessDenied: 'تم رفض الوصول. لا تملك صلاحية على هذا المورد.',
    returnToDashboard: 'العودة للوحة التحكم',

    // Theme Catalog
    platformThemes: 'ثيمات المنصة',
    availableVersions: 'الإصدارات المتاحة',
    install: 'تثبيت الثيم',
    reinstall: 'تبديل / إعادة التثبيت',
    active: 'نشط',
    version: 'الإصدار',
    statusHeader: 'الحالة',
    actions: 'الإجراء',
    loadingThemes: 'جاري تحميل الثيمات...',
    loadingVersions: 'جاري تحميل الإصدارات...',
    noThemesFound: 'لا توجد ثيمات متاحة.',
    noVersions: 'لا توجد إصدارات لهذا الثيم.',
    selectThemePrompt: 'اختر ثيماً من القائمة لعرض إصداراته.',
    installThemeTitle: 'تأكيد تثبيت الثيم',
    installConfirmMessage: 'هل أنت تأكد من تثبيت الثيم',
    installConfirmWarning: 'سيؤدي هذا إلى تحديث ثيم المتجر النشط.',
    confirmInstall: 'تثبيت',
    cancel: 'إلغاء',

    // Theme Editor
    currentStoreTheme: 'ثيم المتجر الحالي',
    draftRev: 'مراجعة المسودة',
    publishedRev: 'المراجعة المنشورة',
    previewDraft: 'معاينة المسودة',
    generatingPreview: 'جاري إعداد المعاينة...',
    saveDraft: 'حفظ المسودة',
    saving: 'جاري الحفظ...',
    discardDraft: 'تجاهل التغييرات',
    publishTheme: 'نشر الثيم',
    draftSavedSuccess: 'تم حفظ المسودة بنجاح.',
    publishSuccess: 'تم نشر المراجعة بنجاح',
    discardSuccess: 'تم التراجع عن التغييرات غير المحفوظة.',
    noThemeInstalled: 'لا يوجد ثيم مثبت حالياً لهذا المتجر.',
    browseCatalog: 'تصفح كتالوج الثيمات',
    loadingInstallation: 'جاري تحميل إعدادات ثيم المتجر...',
    editorTitle: 'محرر مخطط إعدادات المسودة',
    noSchemaAvailable: 'لا يتوفر مخطط إعدادات لهذا الإصدار.',

    // Upgrade
    upgradeAvailable: 'يتوفر تحديث جديد للثيم',
    upgradeHint: 'تتوفر إصدارات أحدث من هذا الثيم في الكتالوج.',
    selectVersion: 'اختر الإصدار',
    upgrade: 'تحديث الإصدار',
    upgradeSuccess: 'تم تحديث إصدار الثيم بنجاح إلى',
    upgradeModalTitle: 'تحديث إصدار الثيم',
    upgradeModalMessage: 'هل أنت تأكد من ترقية ثيم المتجر إلى الإصدار',

    // Modals
    publishModalTitle: 'نشر مسودة الثيم',
    publishModalMessage: 'هل أنت تأكد من نشر إعدادات هذه المسودة على متجرك المباشر؟',
    publish: 'نشر مباشر',
    discardModalTitle: 'التراجع عن تغييرات المسودة',
    discardModalMessage: 'هل أنت تأكد من التراجع عن تغييرات المسودة؟ سيتم استعادة آخر مسودة محفوظة أو إعدادات منشورة.',
    discard: 'التراجع عن التغييرات',

    // Schema Editor Controls
    enabled: 'مفعل',
    disabled: 'معطل',
    select: 'اختر',
    addItem: 'إضافة عنصر',
    remove: 'حذف',
    unsupportedField: 'نوع حقل غير مدعوم',
    noSchemaProperties: 'لا توجد حقول إعدادات قابلة للتعديل.'
  },
  en: {
    appName: 'Seller Dashboard',
    status: 'Ready for build',
    dashboard: 'Dashboard',
    themeCatalog: 'Theme Catalog',
    storeThemeManagement: 'Store Theme',
    activeStore: 'Active Store',

    // Auth
    signIn: 'Sign In with ZITADEL',
    signOut: 'Sign Out',
    authenticating: 'Completing authentication...',
    checkingAuth: 'Checking session...',
    loginPrompt: 'Please sign in with your ZITADEL account to manage your store themes.',
    accessDenied: 'Access denied. You do not have permission for this resource.',
    returnToDashboard: 'Return to Dashboard',

    // Theme Catalog
    platformThemes: 'Platform Themes',
    availableVersions: 'Available Versions',
    install: 'Install Theme',
    reinstall: 'Switch / Reinstall',
    active: 'Active',
    version: 'Version',
    statusHeader: 'Status',
    actions: 'Actions',
    loadingThemes: 'Loading theme catalog...',
    loadingVersions: 'Loading versions...',
    noThemesFound: 'No themes available.',
    noVersions: 'No versions found for this theme.',
    selectThemePrompt: 'Select a theme to inspect versions.',
    installThemeTitle: 'Confirm Theme Installation',
    installConfirmMessage: 'Are you sure you want to install',
    installConfirmWarning: 'This will update your active store theme installation.',
    confirmInstall: 'Install',
    cancel: 'Cancel',

    // Theme Editor
    currentStoreTheme: 'Current Store Theme',
    draftRev: 'Draft Rev',
    publishedRev: 'Published Rev',
    previewDraft: 'Preview Draft',
    generatingPreview: 'Preparing Preview...',
    saveDraft: 'Save Draft',
    saving: 'Saving...',
    discardDraft: 'Discard Changes',
    publishTheme: 'Publish Theme',
    draftSavedSuccess: 'Draft saved successfully.',
    publishSuccess: 'Published revision successfully',
    discardSuccess: 'Draft changes discarded.',
    noThemeInstalled: 'No theme is currently installed for this store.',
    browseCatalog: 'Browse Theme Catalog',
    loadingInstallation: 'Loading store theme configuration...',
    editorTitle: 'Draft Configuration Schema Editor',
    noSchemaAvailable: 'No configuration schema available for this version.',

    // Upgrade
    upgradeAvailable: 'Theme Upgrade Available',
    upgradeHint: 'Newer theme versions are available in the platform catalog.',
    selectVersion: 'Select version',
    upgrade: 'Upgrade Version',
    upgradeSuccess: 'Upgraded theme version successfully to',
    upgradeModalTitle: 'Upgrade Theme Version',
    upgradeModalMessage: 'Are you sure you want to upgrade your store theme to version',

    // Modals
    publishModalTitle: 'Publish Draft Theme',
    publishModalMessage: 'Are you sure you want to publish this draft configuration to your live storefront?',
    publish: 'Publish Live',
    discardModalTitle: 'Discard Draft Changes',
    discardModalMessage: 'Are you sure you want to discard your draft changes? Unsaved modifications will be reverted to the last saved draft or published configuration.',
    discard: 'Discard Changes',

    // Schema Editor Controls
    enabled: 'Enabled',
    disabled: 'Disabled',
    select: 'Select',
    addItem: 'Add Item',
    remove: 'Remove',
    unsupportedField: 'Unsupported field type',
    noSchemaProperties: 'No editable configuration fields found.'
  }
};

export function directionFor(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
