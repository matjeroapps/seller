import type { SellerScreenConfig } from './SellerScreen';

export const customerManagementScreen: SellerScreenConfig = {
  eyebrow: 'إدارة العملاء وقاعدة البيانات',
  title: 'عملاء المتجر، الشرائح، وسجل التعاملات',
  description: 'واجهة Stitch لإدارة قاعدة العملاء: البحث، الشرائح الذكية، حالة الحساب، العناوين، حدود الائتمان، والتواصل التسويقي من مكان واحد.',
  actions: [
    { label: 'إضافة عميل جديد', href: '/dashboard/stores/:storeId/customers/new', variant: 'primary' },
    { label: 'استيراد CSV', variant: 'secondary' },
    { label: 'تصدير العملاء', variant: 'secondary' }
  ],
  metrics: [
    { label: 'إجمالي العملاء', value: '—', hint: 'يعرض من واجهة العملاء عند توفرها', tone: 'emerald' },
    { label: 'عملاء نشطون', value: '—', hint: 'آخر 30 يوم', tone: 'sky' },
    { label: 'محافظ تحتاج مراجعة', value: '—', hint: 'حد ائتماني أو رصيد معلق', tone: 'amber' },
    { label: 'طلبات دعم مفتوحة', value: '—', hint: 'مرتبطة بملفات العملاء', tone: 'rose' }
  ],
  sections: [
    {
      kicker: 'قاعدة البيانات',
      title: 'جدول العملاء والتحكم السريع',
      description: 'يمثل تصميم Stitch جدول العملاء مع البحث، الفلاتر، الحالة، آخر طلب، إجمالي الإنفاق، ووسوم العميل.',
      items: [
        { title: 'بحث موحد بالاسم، الجوال، البريد، أو رقم العميل', meta: 'حقل بحث أمامي جاهز للربط مع API العملاء.', status: 'جاهز UI', tone: 'emerald' },
        { title: 'فلاتر الشرائح والحالة', meta: 'نشط، جديد، B2B، محفظة، ائتمان، أو تسويق.', status: 'Stitch', tone: 'sky' },
        { title: 'إجراءات الصف', meta: 'فتح الملف، إنشاء طلب، إرسال رسالة، وتعليق داخلي.', status: 'يتطلب API', tone: 'amber' }
      ]
    },
    {
      kicker: 'شرائح',
      title: 'شرائح العملاء',
      items: [
        { title: 'عملاء VIP', meta: 'إنفاق مرتفع وتكرار شراء منتظم.', status: 'Segment', tone: 'violet' },
        { title: 'عملاء B2B', meta: 'حقول ضريبية وحد ائتماني وعناوين شحن متعددة.', status: 'B2B', tone: 'sky' },
        { title: 'عملاء غير نشطين', meta: 'مرشح لحملات إعادة التفعيل.', status: 'تنبيه', tone: 'amber' }
      ]
    }
  ],
  rail: [
    {
      title: 'إجراءات العملاء',
      items: [
        { title: 'إنشاء طلب جديد', meta: 'ابدأ طلباً نيابة عن العميل.', status: 'Action', tone: 'emerald' },
        { title: 'إرسال حملة', meta: 'اختيار شريحة وإرسال تنبيه.', status: 'Marketing', tone: 'violet' }
      ]
    }
  ]
};

export const addCustomerScreen: SellerScreenConfig = {
  eyebrow: 'إضافة عميل جديد - متجر هب',
  title: 'إنشاء ملف عميل مع العنوان، الضريبة، والمحفظة',
  description: 'يعكس شاشة Stitch لإضافة عميل جديد عبر أقسام واضحة تشمل المعلومات الشخصية، عنوان SPL، بيانات ZATCA، حدود الائتمان، التفضيلات، والوسوم.',
  actions: [
    { label: 'حفظ العميل', variant: 'primary' },
    { label: 'حفظ كمسودة', variant: 'secondary' },
    { label: 'العودة للعملاء', href: '/dashboard/stores/:storeId/customers', variant: 'secondary' }
  ],
  sections: [
    {
      kicker: 'البيانات الأساسية',
      title: 'المعلومات الشخصية والحساب',
      fields: [
        { label: 'الاسم الكامل', value: 'مثال: نورة العتيبي', hint: 'حقل مطلوب في تصميم Stitch.' },
        { label: 'رقم الجوال', value: '+966 5X XXX XXXX', hint: 'يدعم التحقق عبر OTP.' },
        { label: 'البريد الإلكتروني', value: 'customer@example.com' },
        { label: 'نوع العميل', value: 'فرد / شركة', type: 'select' }
      ]
    },
    {
      kicker: 'العنوان الوطني',
      title: 'عنوان الشحن والفوترة',
      fields: [
        { label: 'المدينة والحي', value: 'الرياض - حي النرجس' },
        { label: 'الرمز البريدي', value: '12345' },
        { label: 'رقم المبنى', value: '7421' },
        { label: 'العنوان الافتراضي', value: 'مفعل', type: 'toggle' }
      ]
    },
    {
      kicker: 'B2B / ZATCA',
      title: 'بيانات الشركة والضريبة',
      fields: [
        { label: 'اسم المنشأة', value: 'اختياري' },
        { label: 'الرقم الضريبي', value: '3XXXXXXXXXXXXXX' },
        { label: 'حد الائتمان', value: '0.00 SAR' },
        { label: 'ملاحظات إدارية', value: 'ملاحظات داخلية لا تظهر للعميل', type: 'textarea' }
      ]
    }
  ],
  rail: [
    {
      title: 'جاهزية الملف',
      fields: [
        { label: 'معلومات التواصل', value: 'مكتملة', type: 'check' },
        { label: 'عنوان افتراضي', value: 'مكتمل', type: 'check' },
        { label: 'الموافقة التسويقية', value: 'مفعلة', type: 'toggle' }
      ]
    }
  ]
};

export const payoutRequestScreen: SellerScreenConfig = {
  eyebrow: 'طلب تحويل وسحب الأرباح',
  title: 'طلب تحويل من المحفظة إلى الحساب البنكي',
  description: 'شاشة Stitch مخصصة لإرسال طلبات السحب مع رصيد المحفظة، طريقة التحويل، الحساب البنكي، ملخص التسوية، والتنبيه بالمراجعة الثنائية.',
  actions: [
    { label: 'إرسال طلب السحب', variant: 'primary' },
    { label: 'تحميل كشف PDF', variant: 'secondary' },
    { label: 'رجوع للمالية', href: '/dashboard/stores/:storeId/finance', variant: 'secondary' }
  ],
  metrics: [
    { label: 'الرصيد المتاح', value: '— SAR', hint: 'يربط مع StoreBalance', tone: 'emerald' },
    { label: 'قيد التسوية', value: '— SAR', hint: 'مدفوعات لم تكتمل', tone: 'amber' },
    { label: 'آخر تحويل', value: '—', hint: 'من سجل payouts', tone: 'sky' },
    { label: 'حالة الحساب البنكي', value: 'موثق', hint: 'يتطلب تحقق بنكي', tone: 'emerald' }
  ],
  sections: [
    {
      kicker: 'الطلب',
      title: 'تفاصيل مبلغ التحويل',
      fields: [
        { label: 'المبلغ المطلوب', value: '0.00 SAR' },
        { label: 'طريقة التحويل', value: 'تحويل بنكي محلي', type: 'select' },
        { label: 'الحساب البنكي', value: 'SA•••• 8842 - بنك الرياض', type: 'select' },
        { label: 'ملاحظة اختيارية', value: 'تظهر لفريق المالية', type: 'textarea' }
      ]
    },
    {
      kicker: 'مراجعة',
      title: 'ملخص التسوية والرسوم',
      items: [
        { title: 'صافي المبلغ المتوقع', meta: 'يحسب من الرصيد المتاح بعد الرسوم والضريبة.', status: 'Calculated', tone: 'sky' },
        { title: 'توثيق ثنائي قبل الإرسال', meta: 'يعكس تنبيه Stitch لخطوة 2FA قبل اعتماد السحب.', status: 'Security', tone: 'amber' }
      ]
    }
  ],
  rail: [
    {
      title: 'آخر التحويلات',
      items: [
        { title: 'طلب تحويل سابق', meta: 'يعرض تاريخ الطلب، الحالة، والمبلغ عند توفر API.', status: 'Pending API', tone: 'slate' }
      ]
    }
  ]
};

export const settingsScreen: SellerScreenConfig = {
  eyebrow: 'إعدادات المتجر والحساب',
  title: 'هوية المتجر، الامتثال، العملة، والسياسات',
  description: 'تنفيذ شاشة Stitch لإعدادات المتجر: الهوية، العنوان اللوجستي، ZATCA، العملة واللغة، سياسات المتجر، وحفظ التغييرات.',
  actions: [
    { label: 'حفظ التغييرات', variant: 'primary' },
    { label: 'معاينة المتجر', href: '/dashboard/stores/:storeId/storefront', variant: 'secondary' }
  ],
  sections: [
    {
      kicker: 'هوية المتجر',
      title: 'الاسم، الشعار، والوصف',
      fields: [
        { label: 'اسم المتجر', value: 'متجر هب' },
        { label: 'رابط المتجر', value: 'store.matjerhub.local' },
        { label: 'وصف مختصر', value: 'وصف يظهر للعملاء ومحركات البحث.', type: 'textarea' },
        { label: 'حالة النشر', value: 'نشط', type: 'select' }
      ]
    },
    {
      kicker: 'تشغيل وامتثال',
      title: 'العنوان، ZATCA، والعملة',
      fields: [
        { label: 'عنوان المستودع الرئيسي', value: 'الرياض، المملكة العربية السعودية' },
        { label: 'الرقم الضريبي', value: '300000000000003' },
        { label: 'العملة الافتراضية', value: 'SAR', type: 'select' },
        { label: 'اللغة الافتراضية', value: 'العربية', type: 'select' }
      ]
    },
    {
      kicker: 'السياسات',
      title: 'الشحن، الاسترجاع، والخصوصية',
      fields: [
        { label: 'سياسة الشحن', value: 'نص السياسة المعروض للعميل', type: 'textarea' },
        { label: 'سياسة الاسترجاع', value: 'نص سياسة الاسترجاع', type: 'textarea' }
      ]
    }
  ],
  rail: [
    {
      title: 'حالة الإعداد',
      fields: [
        { label: 'هوية المتجر', value: 'مكتملة', type: 'check' },
        { label: 'ZATCA', value: 'قيد التحقق', type: 'check' },
        { label: 'السياسات', value: 'مكتملة', type: 'check' }
      ]
    }
  ]
};

export const profileAccountScreen: SellerScreenConfig = {
  eyebrow: 'الملف الشخصي والحساب',
  title: 'إدارة الملف الشخصي، التوثيق، والأمان',
  description: 'تفاصيل شاشة Stitch تشمل بيانات التاجر الشخصية والمهنية، توثيق الهوية والسجل التجاري، كلمة المرور، 2FA، Passkeys، الجلسات النشطة، ومساحات العمل المرتبطة.',
  actions: [
    { label: 'حفظ التغييرات', variant: 'primary' },
    { label: 'إلغاء والتراجع', variant: 'secondary' },
    { label: 'إعدادات المتجر', href: '/dashboard/stores/:storeId/settings', variant: 'secondary' }
  ],
  metrics: [
    { label: 'جاهزية الحساب', value: '—', hint: 'يربط مع حالة التوثيق عند توفر API', tone: 'emerald' },
    { label: 'الأجهزة النشطة', value: '—', hint: 'جلسات مرتبطة بالحساب', tone: 'sky' },
    { label: 'عمليات السحب الموثقة', value: '—', hint: 'مصادقات مالية شخصية', tone: 'violet' },
    { label: 'متوسط الرد', value: '—', hint: 'متوسط تفاعل الفريق', tone: 'amber' }
  ],
  sections: [
    {
      kicker: 'البيانات الشخصية',
      title: 'المعلومات الشخصية والاتصال',
      fields: [
        { label: 'الاسم الكامل', value: 'يربط مع ملف المستخدم' },
        { label: 'المسمى الوظيفي', value: 'يربط مع دور المستخدم' },
        { label: 'البريد الإلكتروني الأساسي', value: 'حالة التحقق من البريد' },
        { label: 'رقم الجوال المعتمد', value: 'حالة الربط والتحقق' },
        { label: 'اللغة المفضلة', value: 'العربية (افتراضي)', type: 'select' },
        { label: 'التوقيت المحلي', value: 'الرياض، المملكة العربية السعودية (GMT+3)', type: 'select' }
      ]
    },
    {
      kicker: 'التوثيق',
      title: 'توثيق الهوية الوطنية والاعتماد التجاري',
      items: [
        { title: 'تم التحقق عبر نفاذ الوطني الموحد', meta: 'يعرض حالة التحقق عند توفر تكامل الهوية.', status: 'Pending API', tone: 'amber' },
        { title: 'رقم الهوية الوطنية المقنّع', meta: 'يعرض بصيغة آمنة من الخدمة الخلفية دون تخزين بيانات حساسة في الواجهة.', status: 'محمي', tone: 'sky' },
        { title: 'نوع الكيان التجاري', meta: 'مؤسسة فردية موثقة مع تاريخ انتهاء السجل.', status: 'نشط', tone: 'emerald' }
      ]
    },
    {
      kicker: 'الأمان',
      title: 'كلمة المرور والتحقق المزدوج',
      fields: [
        { label: 'كلمة المرور المشفرة', value: 'يعرض عمر كلمة المرور من API الأمان' },
        { label: 'التحقق بخطوتين (2FA)', value: 'حالة التفعيل', type: 'toggle' },
        { label: 'رموز الاسترداد', value: 'عدد الرموز المتبقية' },
        { label: 'مفاتيح المرور البيومترية', value: 'عدد مفاتيح Passkeys المسجلة' }
      ]
    }
  ],
  rail: [
    {
      title: 'الأجهزة والجلسات النشطة',
      items: [
        { title: 'الجهاز الحالي', meta: 'يعرض المتصفح والموقع التقريبي وآخر نشاط عند توفر API الجلسات.', status: 'Pending API', tone: 'amber' },
        { title: 'الأجهزة الأخرى', meta: 'مساحة لقائمة الأجهزة المتصلة وخيار تسجيل الخروج من الجلسات الأخرى.', status: 'Security', tone: 'sky' }
      ]
    },
    {
      title: 'المتاجر ومساحات العمل',
      items: [
        { title: 'المتجر الحالي', meta: 'يعرض دور المستخدم في مساحة العمل النشطة.', status: 'Active', tone: 'emerald' },
        { title: 'مساحات العمل الأخرى', meta: 'يعرض المتاجر المرتبطة بالحساب عند توفر API الفرق.', status: 'Pending API', tone: 'amber' }
      ]
    }
  ]
};

export const analyticsScreen: SellerScreenConfig = {
  eyebrow: 'التحليلات والتقارير المتقدمة',
  title: 'لوحة تقارير الأداء، المبيعات، والعمليات',
  description: 'يغطي تصميم Stitch لوحة التحليلات المتقدمة مع KPIs، الرسوم البيانية، تقارير القنوات، المنتجات، العملاء، والتصدير.',
  actions: [
    { label: 'تصدير التقرير', variant: 'primary' },
    { label: 'جدولة تقرير', variant: 'secondary' }
  ],
  metrics: [
    { label: 'المبيعات', value: '— SAR', hint: 'حسب النطاق الزمني', tone: 'emerald' },
    { label: 'الطلبات', value: '—', hint: 'مكتملة ومعلقة', tone: 'sky' },
    { label: 'معدل التحويل', value: '—%', hint: 'الجلسات إلى طلبات', tone: 'violet' },
    { label: 'المرتجعات', value: '—', hint: 'طلبات تحتاج متابعة', tone: 'amber' }
  ],
  sections: [
    {
      title: 'تقارير الأداء الرئيسية',
      items: [
        { title: 'منحنى المبيعات', meta: 'مساحة مخصصة للرسم البياني اليومي/الأسبوعي.', status: 'Chart', tone: 'sky' },
        { title: 'أفضل المنتجات', meta: 'المنتجات الأعلى إيراداً وهامشاً.', status: 'Report', tone: 'emerald' },
        { title: 'قنوات البيع', meta: 'المتجر، الربط الخارجي، الطلبات اليدوية.', status: 'Channels', tone: 'violet' }
      ]
    }
  ]
};

export const notificationsScreen: SellerScreenConfig = {
  eyebrow: 'مركز الإشعارات والتنبيهات',
  title: 'تنبيهات العمليات، المخزون، المالية، والتكاملات',
  description: 'يعكس تصميم Stitch مركز إشعارات موحد بفلاتر الأولوية، الحالة، القنوات، وإعدادات التنبيه للفريق.',
  actions: [
    { label: 'تعليم الكل كمقروء', variant: 'primary' },
    { label: 'إعدادات التنبيهات', href: '/dashboard/stores/:storeId/settings', variant: 'secondary' }
  ],
  sections: [
    {
      title: 'صندوق التنبيهات',
      items: [
        { title: 'طلب يحتاج تجهيز', meta: 'تنبيه تشغيلي مرتبط بالطلبات والشحن.', status: 'عالي', tone: 'rose' },
        { title: 'منتج منخفض المخزون', meta: 'مرتبط بالمخزون والمستودعات.', status: 'متوسط', tone: 'amber' },
        { title: 'Webhook فشل في الإرسال', meta: 'مرتبط بمركز الربط والتكامل.', status: 'تقني', tone: 'sky' }
      ]
    },
    {
      title: 'قنوات التنبيه',
      fields: [
        { label: 'داخل لوحة التحكم', value: 'مفعل', type: 'toggle' },
        { label: 'البريد الإلكتروني', value: 'مفعل', type: 'toggle' },
        { label: 'رسائل SMS / WhatsApp', value: 'اختياري', type: 'toggle' }
      ]
    }
  ]
};

export const cartsScreen: SellerScreenConfig = {
  eyebrow: 'إدارة السلات الشرائية',
  title: 'السلات النشطة والمتروكة واسترداد المبيعات',
  description: 'تنفيذ شاشة Stitch لمراقبة السلات، مراحل التخلي، قيمة السلة، آخر نشاط، وإجراءات التواصل والاسترداد.',
  actions: [
    { label: 'إطلاق حملة استرداد', variant: 'primary' },
    { label: 'تصدير السلات', variant: 'secondary' }
  ],
  metrics: [
    { label: 'سلات نشطة', value: '—', hint: 'آخر 24 ساعة', tone: 'sky' },
    { label: 'سلات متروكة', value: '—', hint: 'قابلة للاسترداد', tone: 'amber' },
    { label: 'قيمة محتملة', value: '— SAR', hint: 'إجمالي السلات', tone: 'emerald' },
    { label: 'معدل الاسترداد', value: '—%', hint: 'بعد الحملات', tone: 'violet' }
  ],
  sections: [
    {
      title: 'قائمة السلات',
      items: [
        { title: 'سلة بمنتجات متعددة', meta: 'تعرض العميل، القيمة، آخر نشاط، والمرحلة.', status: 'Active', tone: 'sky' },
        { title: 'سلة متروكة', meta: 'إجراء سريع لإرسال تذكير أو قسيمة.', status: 'Recovery', tone: 'amber' }
      ]
    }
  ]
};

export const newOrderScreen: SellerScreenConfig = {
  eyebrow: 'إنشاء طلب جديد',
  title: 'طلب يدوي مع اختيار العميل، المنتجات، الشحن، والدفع',
  description: 'شاشة Stitch لإنشاء طلب من لوحة التاجر مع ملخص جانبي، تحقق مخزون، عنوان شحن، خيارات دفع، وفاتورة ZATCA.',
  actions: [
    { label: 'إنشاء الطلب', variant: 'primary' },
    { label: 'حفظ كمسودة', variant: 'secondary' },
    { label: 'العودة للطلبات', href: '/dashboard/stores/:storeId/orders', variant: 'secondary' }
  ],
  sections: [
    {
      title: 'بيانات العميل والطلب',
      fields: [
        { label: 'اختيار العميل', value: 'ابحث بالاسم أو الجوال', type: 'select' },
        { label: 'قناة الطلب', value: 'طلب يدوي', type: 'select' },
        { label: 'عنوان الشحن', value: 'العنوان الافتراضي للعميل', type: 'select' },
        { label: 'ملاحظة داخلية', value: 'ملاحظات لفريق التجهيز', type: 'textarea' }
      ]
    },
    {
      title: 'المنتجات والدفع',
      fields: [
        { label: 'إضافة منتج', value: 'بحث في الكتالوج' },
        { label: 'طريقة الدفع', value: 'مدفوع / دفع عند الاستلام', type: 'select' },
        { label: 'طريقة الشحن', value: 'شركة الشحن الافتراضية', type: 'select' },
        { label: 'إصدار فاتورة ZATCA', value: 'مفعل', type: 'toggle' }
      ]
    }
  ],
  rail: [
    {
      title: 'ملخص الطلب',
      items: [
        { title: 'الإجمالي', meta: 'يحسب بعد إضافة المنتجات والشحن والضريبة.', status: 'Live', tone: 'emerald' }
      ]
    }
  ]
};

export const usersScreen: SellerScreenConfig = {
  eyebrow: 'إدارة المستخدمين وفريق العمل',
  title: 'الأدوار، الصلاحيات، ودعوات الفريق',
  description: 'تنفيذ شاشة Stitch لإدارة فريق المتجر مع الدعوات، الأدوار، حالة الوصول، وسجل النشاط.',
  actions: [
    { label: 'دعوة مستخدم', variant: 'primary' },
    { label: 'إدارة الأدوار', variant: 'secondary' }
  ],
  sections: [
    {
      title: 'أعضاء الفريق',
      items: [
        { title: 'مالك المتجر', meta: 'صلاحيات كاملة على الإعدادات والمالية.', status: 'Owner', tone: 'emerald' },
        { title: 'مدير العمليات', meta: 'الطلبات، الشحن، المخزون، والعملاء.', status: 'Ops', tone: 'sky' },
        { title: 'محاسب', meta: 'المالية، التسويات، وتقارير ZATCA.', status: 'Finance', tone: 'violet' }
      ]
    },
    {
      title: 'سياسات الأمان',
      fields: [
        { label: 'تسجيل دخول ثنائي', value: 'مطلوب', type: 'toggle' },
        { label: 'تسجيل نشاط المستخدمين', value: 'مفعل', type: 'toggle' }
      ]
    }
  ]
};

export const billingScreen: SellerScreenConfig = {
  eyebrow: 'الخطة والاشتراك وإدارة الباقات',
  title: 'الخطة الحالية، الفواتير، وحدود الاستخدام',
  description: 'يعكس تصميم Stitch شاشة الاشتراك والباقات مع الخطة الحالية، المزايا، الفواتير، الترقية، وطريقة الدفع.',
  actions: [
    { label: 'ترقية الخطة', variant: 'primary' },
    { label: 'تحميل الفواتير', variant: 'secondary' }
  ],
  metrics: [
    { label: 'الخطة الحالية', value: '—', hint: 'تربط مع billing API', tone: 'violet' },
    { label: 'استخدام المنتجات', value: '—', hint: 'حدود الكتالوج', tone: 'sky' },
    { label: 'أعضاء الفريق', value: '—', hint: 'حسب الخطة', tone: 'emerald' },
    { label: 'الفاتورة القادمة', value: '— SAR', hint: 'تاريخ الاستحقاق', tone: 'amber' }
  ],
  sections: [
    {
      title: 'تفاصيل الاشتراك',
      items: [
        { title: 'المزايا المتاحة', meta: 'متاجر، منتجات، تكاملات، وتقارير.', status: 'Plan', tone: 'violet' },
        { title: 'طريقة الدفع', meta: 'بطاقة أو تحويل حسب إعدادات السوق.', status: 'Payment', tone: 'sky' }
      ]
    }
  ]
};

export const shippingDocumentsScreen: SellerScreenConfig = {
  eyebrow: 'معاينة وطباعة بوليصة الشحن والفاتورة ZATCA',
  title: 'مستندات الطلب: ملصق الشحن، العنوان، والفاتورة',
  description: 'يغطي تصميم Stitch شاشة مراجعة وطباعة مستندات الطلب قبل التسليم: بوليصة الشحن، ملصق العنوان، فاتورة ZATCA، وإجراءات التنزيل والطباعة.',
  actions: [
    { label: 'طباعة المستندات', variant: 'primary' },
    { label: 'تحميل PDF', variant: 'secondary' },
    { label: 'رجوع للطلب', href: '/dashboard/stores/:storeId/orders', variant: 'secondary' }
  ],
  sections: [
    {
      kicker: 'المعاينة',
      title: 'بوليصة الشحن وملصق العنوان',
      fields: [
        { label: 'شركة الشحن', value: 'مزود الشحن المرتبط بالطلب', type: 'select' },
        { label: 'رقم التتبع', value: 'Tracking number' },
        { label: 'عنوان المستلم', value: 'يقرأ من عنوان الطلب', type: 'textarea' },
        { label: 'جاهز للطباعة', value: 'مكتمل', type: 'check' }
      ]
    },
    {
      kicker: 'ZATCA',
      title: 'الفاتورة الضريبية',
      items: [
        { title: 'QR ضريبي', meta: 'مساحة مخصصة لبيانات الفاتورة الإلكترونية عند توفرها من Core.', status: 'ZATCA', tone: 'emerald' },
        { title: 'ملخص الضريبة والإجمالي', meta: 'يظهر من بيانات الطلب والمدفوعات الحالية.', status: 'Invoice', tone: 'sky' }
      ]
    }
  ],
  rail: [
    {
      title: 'حالة المستندات',
      items: [
        { title: 'بوليصة الشحن', meta: 'جاهزة عند وجود شحنة مرتبطة.', status: 'Ready', tone: 'emerald' },
        { title: 'الفاتورة', meta: 'تتطلب بيانات ZATCA من الخدمة الخلفية.', status: 'Pending API', tone: 'amber' }
      ]
    }
  ]
};
