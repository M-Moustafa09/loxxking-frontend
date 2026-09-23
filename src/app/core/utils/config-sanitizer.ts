import arJson from '../../../assets/i18n/ar.json';

const translationMap: Record<string, string> = {};

function flatten(obj: any, prefix = ''): void {
  if (!obj || typeof obj !== 'object') return;
  for (const k of Object.keys(obj)) {
    if (k === 'default' && typeof obj[k] === 'object' && obj[k] !== null && !prefix) {
      flatten(obj[k], '');
      continue;
    }
    const val = obj[k];
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof val === 'string') {
      translationMap[fullKey] = val;
    } else if (typeof val === 'object' && val !== null) {
      flatten(val, fullKey);
    }
  }
}

// Unpack default export wrapper if present in ES module bundle
const rawJson = (arJson && (arJson as any).default && typeof (arJson as any).default === 'object')
  ? (arJson as any).default
  : arJson;
flatten(rawJson);
if ((arJson as any).default && (arJson as any).default !== rawJson) {
  flatten((arJson as any).default);
}
flatten(arJson);

/**
 * Hardcoded safety map for standard translation keys to guarantee instant resolution
 */
const fallbackSafetyMap: Record<string, string> = {
  'HOME.BEST_SELLERS_ALT': 'الأكثر مبيعاً',
  'HOME.BEST_SELLERS': 'الأكثر مبيعاً',
  'PRODUCT.COLOR': 'اللون',
  'PRODUCT.SIZE': 'المقاس',
  'PRODUCT.SIZE_GUIDE': 'دليل المقاسات',
  'COMMON.ADDRESS': 'العنوان',
  'PRODUCT.DESCRIPTION': 'الوصف',
  'CART.TITLE': 'سلة المشتريات',
  'CART.TOTAL': 'الإجمالي',
  'COMMON.SUBTOTAL': 'المجموع الفرعي',
  'COMMON.DELIVERY': 'رسوم الشحن',
  'COMMON.PENDING': 'قيد الانتظار',
  'COMMON.CONFIRMED': 'مؤكد',
  'COMMON.SHIPPED': 'تم الشحن',
  'COMMON.DELIVERED': 'تم التسليم',
  'COMMON.CANCELLED': 'ملغي',
  'COMMON.ALL': 'الكل',
  'COMMON.CASHONDELIVERY': 'الدفع عند الاستلام',
  'CHECKOUT.BANK_TRANSFER': 'تحويل بنكي',
  'COMMON.ACCEPTORDER': 'قبول الطلب',
  'COMMON.OUTOFSTOCK': 'غير متوفر',
  'CHECKOUT.CUSTOMER_NAME': 'اسم العميل',
  'CHECKOUT.PHONE': 'رقم الهاتف',
  'CHECKOUT.COUNTRY': 'الدولة',
  'CHECKOUT.CITY': 'المدينة',
  'ORDERS.ORDER_NUMBER': 'رقم الطلب',
  'ORDERS.ORDER_DATE': 'تاريخ الطلب',
  'ORDERS.STATUS': 'الحالة',
  'CHECKOUT.PAYMENT_METHOD': 'طريقة الدفع',
  'COMMON.WOMENS': 'نسائي',
  'COMMON.LOADING': 'جاري التحميل...'
};

/**
 * Resolves a translation key (e.g. 'HOME.BEST_SELLERS_ALT', 'PRODUCT.COLOR')
 * to its human-readable Arabic text. If the text is already custom Arabic, it is preserved.
 */
export function resolveTranslationKey(val: any): any {
  if (val === undefined || val === null) return val;

  if (typeof val !== 'string') {
    if (Array.isArray(val)) {
      return val.map(item => resolveTranslationKey(item));
    }
    if (typeof val === 'object') {
      const res: any = {};
      for (const k of Object.keys(val)) {
        res[k] = resolveTranslationKey(val[k]);
      }
      return res;
    }
    return val;
  }

  const trimmed = val.trim();

  // If translationMap has exact match
  if (translationMap[trimmed]) {
    return translationMap[trimmed];
  }

  // If prefixed with 'default.'
  if (translationMap[`default.${trimmed}`]) {
    return translationMap[`default.${trimmed}`];
  }

  // Strip 'default.' if present
  if (trimmed.startsWith('default.')) {
    const stripped = trimmed.slice(8);
    if (translationMap[stripped]) {
      return translationMap[stripped];
    }
  }

  // Fallback safety map
  if (fallbackSafetyMap[trimmed]) {
    return fallbackSafetyMap[trimmed];
  }

  // Dotted key pattern matching
  if (/^[A-Z0-9_]+(\.[A-Z0-9_]+)+$/.test(trimmed)) {
    if (translationMap[trimmed]) {
      return translationMap[trimmed];
    }
  }

  return val;
}

// Run automatic one-time migration of any persisted localStorage configs
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const allKeys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && (k.startsWith('loxxking-') || k.startsWith('lk-config-'))) {
        allKeys.push(k);
      }
    }
    for (const key of allKeys) {
      const val = window.localStorage.getItem(key);
      if (val && (val.includes('.') || val.includes('BEST_SELLERS') || val.includes('PRODUCT.') || val.includes('AUTO_STR'))) {
        try {
          const parsed = JSON.parse(val);
          const sanitized = sanitizeLocalizedFields(resolveTranslationKey(parsed));
          window.localStorage.setItem(key, JSON.stringify(sanitized));
        } catch (_) {}
      }
    }
  } catch (_) {}
}

export const AR_TO_EN_MAP: Record<string, string> = {
  // Home Page
  'مشدات فاخرة وتشكيلة مميزة': 'Luxury Shapers & Premium Collection',
  'شد أقوى\nوقوام أفضل': 'Stronger Sculpt\n& Better Silhouette',
  'شد أقوى وقوام أفضل': 'Stronger Sculpt & Better Silhouette',
  'عنوان الشريحة': 'Slide Title',
  'الصورة الرئيسية (البانر)': 'Main Hero Banner',
  'الشريط المميز تحت البانر': 'Featured Benefits',
  'دفع عند الاستلام\nادفع بعد الاستلام': 'Cash on Delivery\nPay upon delivery',
  'الدفع عند الاستلام': 'Cash on Delivery',
  'دفع عند الاستلام': 'Cash on Delivery',
  'ادفع بعد الاستلام': 'Pay upon delivery',
  'الدفع لاحقا': 'Pay Later',
  'دفع لاحقا': 'Pay Later',
  'الدلتا': 'Delta Delivery',
  'شحن مجاني\nلجميع الطلبات في المملكة': 'Free Shipping\nOn all orders in KSA',
  'شحن مجاني': 'Free Shipping',
  'مجاني لجميع الطلبات في المملكة': 'Free for all orders in KSA',
  'استرجاع مجاني\nخلال 14 يوم بكل سهولة': 'Free Returns\nWithin 14 days easily',
  'استرجاع مجاني': 'Free Returns',
  'خلال 14 يوم بكل سهولة': 'Within 14 days easily',
  'توصيل سريع ومجاني': 'Fast & Free Delivery',
  'دفع آمن عند الاستلام': 'Secure Cash on Delivery',
  'تسوق حسب الفئة': 'Shop by Category',
  'الأكثر مبيعاً': 'Bestsellers',
  'بانر العروض الترويجية': 'Promotional Offers',
  'عروض ترويجية': 'Promotional Offers',
  'نساء': "Women's",
  'مشدات نسائية': "Women's Shapers",
  'رياضي': 'Sports',
  'مشدات رياضية': 'Sports Shapers',
  'ما بعد الولادة': 'Postpartum',
  'مشدات ما بعد الولادة': 'Postpartum Shapers',
  'رجالي': "Men's",
  'مشدات رجالية': "Men's Shapers",
  'مشد كامل للجسم': 'Full Body Shaper',
  'مشد الجسم الكامل': 'Full Body Shaper',
  'مشد ما بعد الولادة': 'Postpartum Shaper',
  'مشد رياضي': 'Sports Shaper',
  'مشد يومي مربع': 'Daily Square Shaper',

  // All Shapers
  'كل المشدات': 'All Shapers',
  'لا توجد منتجات بهذه المواصفات': 'No products match these specifications',
  'جرّبي تغيير اللون أو المقاس أو نطاق السعر.': 'Try changing the color, size or price range.',
  'عرض كل المشدات': 'View All Shapers',

  // Cart Page
  'سلة التسوق': 'Shopping Cart',
  'سلة المشتريات': 'Shopping Cart',
  'كود الخصم': 'Discount Code',
  'ادخل كود الخصم': 'Enter discount code',
  'تطبيق': 'Apply',
  'إتمام الطلب': 'Checkout',
  'السلة فارغة': 'Cart is empty',
  'منتجات أصلية': 'Original Products',
  '100% مضمونة': '100% Guaranteed',
  'شحن سريع': 'Fast Shipping',
  'خلال 2 - 5 أيام': 'Within 2 - 5 days',
  'إرجاع سهل': 'Easy Returns',
  'خلال 14 يوم': 'Within 14 days',
  'دفع آمن': 'Secure Payment',
  '100% آمن': '100% Secure',

  // FAQ Page
  'الأسئلة الشائعة': 'Frequently Asked Questions',
  'ابحث عن إجابات لأسئلتك الشائعة هنا': 'Find answers to your questions here',
  'ابحث في الأسئلة': 'Search questions',
  'لم تجد ما تبحث عنه؟': "Didn't find what you are looking for?",
  'تواصل معنا على الواتساب': 'Contact us on WhatsApp',
  'كيف اعرف مقاسي؟': 'How do I know my size?',
  'يمكنك معرفة مقاسك من خلال جدول المقاسات': 'You can find your size from the size chart',
  'سؤال جديد': 'New Question',
  'إجابة جديدة': 'New Answer',

  // Search Page
  'ابحث عن...': 'Search for...',
  'عمليات بحث شائعة:': 'Popular Searches:',
  'عمليات البحث الشائعة': 'Popular Searches',
  'مشد خصر رجالي': "Men's Waist Trainer",
  'مشد خصر نسائي': "Women's Waist Trainer",
  'مشد خصر للتنحيف': 'Slimming Waist Trainer',
  'مشد خصر بعد الولادة': 'Postpartum Waist Trainer',
  'عمليات البحث الأخيرة': 'Recent Searches',
  'لم يتم العثور على أي منتج': 'No products found',
  'جرب استخدام كلمات بحث مختلفة أو تصفح المنتجات الشائعة': 'Try different search keywords or browse popular products',

  // About Page
  'من نحن': 'About Us',
  'العنوان الرئيسي': 'Main Title',
  'النص الفرعي': 'Subtitle',
  'نص المقدمة': 'Intro Text',
  'رؤيتنا': 'Our Vision',
  'رسالتنا': 'Our Mission',
  'قيمنا': 'Our Values',
  'لوكس كينج... ثقتك، راحتك، جمالك': 'Loxxking... Your Confidence, Comfort, and Beauty',
  'لماذا نحن؟': 'Why Us?',
  'جودة استثنائية': 'Exceptional Quality',
  'راحة تامة': 'Total Comfort',
  'نتائج ملحوظة': 'Visible Results',
  'المصداقية': 'Integrity',
  'العناية بالعميل': 'Customer Care',
  'الجودة العالية': 'High Quality',
  'الابتكار المستمر': 'Continuous Innovation',
  'الشفافية': 'Transparency',
  'فيسبوك': 'Facebook',
  'إنستغرام': 'Instagram',
  'بريد إلكتروني': 'Email',
  'اتصال': 'Phone Call',
  'واتساب': 'WhatsApp',

  // Contact Page
  'تواصل معنا': 'Contact Us',
  'العنوان': 'Address',
  'الوصف': 'Description',
  'خدمة العملاء': 'Customer Service',
  'أرسل لنا رسالة': 'Send Us a Message',
  'سنقوم بالرد عليك في أقرب وقت ممكن.': 'We will get back to you as soon as possible.',
  'نحن هنا لمساعدتك والإجابة على كافة استفساراتك.': 'We are here to help and answer all your inquiries.',
  'رقم جديد': 'New Number',
  'طريقة جديدة': 'New Method',
  'ميزة جديدة': 'New Feature',
  'قيمة جديدة': 'New Value',
  'طريقة تواصل': 'Contact Method',
  'وصف قصير': 'Short Description',

  // Checkout Page
  'الدفع والطلب': 'Checkout & Order',
  'معلومات التوصيل': 'Delivery Information',
  'طريقة الدفع': 'Payment Method',
  'تحويل بنكي': 'Bank Transfer',
  'بيانات العميل': 'Customer Details',
  'أدخل بياناتك لإكمال الطلب': 'Enter your details to complete the order',
  'ملخص الطلب': 'Order Summary',
  'تسوق آمن': 'Safe Shopping',
  'نحن نضمن حماية بياناتك ومعلوماتك الشخصية': 'We ensure full protection of your personal information',
  'لا توجد منتجات لإتمام الطلب': 'No items to checkout',
  'أضيفي المنتجات إلى السلة أولًا ثم تابعي إتمام الطلب.': 'Please add items to your cart first before proceeding to checkout.',
  'عودة إلى السلة': 'Return to Cart',

  // Categories Page
  'التصنيفات': 'Categories',
  'تصفح جميع المنتجات حسب الفئة': 'Browse all products by category',
  'تسوق حسب القسم': 'Shop by Department',

  // Offers Page
  'عروض خاصة': 'Special Offers',
  'أفضل الأسعار لفترة محدودة': 'Best Prices for a Limited Time',
  'التخفيضات الحالية': 'Current Discounts',
  'وفر أكثر مع الباقات': 'Save More with Bundles',
  'اختار الباقة الأنسب لك بأسعار مخفضة': 'Choose the best bundle for you at discounted prices',
  'عروض شراء أكثر من قطعة': 'Multi-Item Deals',
  'العروض محدودة المدة': 'Limited-Time Offers',
  'ينتهي العرض قريباً': 'Offer Ends Soon',

  // Common UI words
  'حفظ': 'Save',
  'إلغاء': 'Cancel',
  'تعديل': 'Edit',
  'حذف': 'Delete',
  'إضافة': 'Add'
};

const ARABIC_REGEX = /[\u0600-\u06FF]/;

export function getEnglishTranslation(arText: string, fallback?: string): string {
  if (!arText || typeof arText !== 'string') return fallback || '';
  const trimmed = arText.trim();
  if (AR_TO_EN_MAP[trimmed]) return AR_TO_EN_MAP[trimmed];
  
  const normalized = trimmed.replace(/\s+/g, ' ');
  if (AR_TO_EN_MAP[normalized]) return AR_TO_EN_MAP[normalized];

  if (fallbackSafetyMap[trimmed]) {
    return fallbackSafetyMap[trimmed];
  }

  // If already pure English/ASCII (no Arabic characters)
  if (!ARABIC_REGEX.test(trimmed)) {
    return trimmed;
  }

  return fallback || '';
}

export function sanitizeLocalizedFields(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeLocalizedFields(item));
  }

  const result: any = { ...obj };
  const keys = Object.keys(result);

  for (const k of keys) {
    if (k.endsWith('En') && k.length > 2) {
      const baseKey = k.slice(0, -2);
      const arKey = baseKey + 'Ar';
      const enVal = result[k];
      const arVal = result[arKey] || result[baseKey];

      if (!enVal || (typeof enVal === 'string' && ARABIC_REGEX.test(enVal))) {
        const translated = getEnglishTranslation(arVal || enVal);
        if (translated) {
          result[k] = translated;
        } else if (typeof enVal === 'string' && ARABIC_REGEX.test(enVal)) {
          result[k] = getEnglishTranslation(arVal) || '';
        }
      }
    } else if (typeof result[k] === 'object' && result[k] !== null) {
      result[k] = sanitizeLocalizedFields(result[k]);
    }
  }

  return result;
}

/**
 * Intelligent deep merge utility:
 * - Prioritizes source (user) values 100%.
 * - Never lets defaults overwrite user booleans, numbers, or empty strings.
 * - Matches array elements by stable id (or type), never by arbitrary numeric index.
 * - Never merges unknown/new items against target[0].
 */
export function deepMerge(target: any, source: any): any {
  if (source === undefined) return target;
  if (target === undefined) return sanitizeLocalizedFields(resolveTranslationKey(source));

  if (typeof source !== 'object' || source === null) {
    return resolveTranslationKey(source);
  }

  if (Array.isArray(source)) {
    return source.map((sourceItem) => {
      if (typeof sourceItem !== 'object' || sourceItem === null) {
        return resolveTranslationKey(sourceItem);
      }

      // Ensure stable id on section/item
      if (!sourceItem.id) {
        const prefix = sourceItem.type ? `sec-${sourceItem.type}-` : 'item-';
        sourceItem.id = prefix + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
      }

      // Find matching template in target array by id, then by type
      let match = undefined;
      if (Array.isArray(target)) {
        if (sourceItem.id) {
          match = target.find((t: any) => t && t.id === sourceItem.id);
        }
        if (!match && sourceItem.type) {
          match = target.find((t: any) => t && t.type === sourceItem.type);
        }
      }

      if (match) {
        return deepMerge(match, sourceItem);
      }

      return sanitizeLocalizedFields(resolveTranslationKey(sourceItem));
    });
  }

  // Object merge: start with source (user data has priority)
  const result: any = { ...source };

  // Resolve any translation keys in source
  for (const key of Object.keys(result)) {
    if (typeof result[key] === 'string') {
      result[key] = resolveTranslationKey(result[key]);
    }
  }

  // Only backfill missing fields from target that are genuinely undefined or null in source
  if (typeof target === 'object' && target !== null && !Array.isArray(target)) {
    for (const key of Object.keys(target)) {
      if (result[key] === undefined || result[key] === null) {
        result[key] = resolveTranslationKey(target[key]);
      } else if (
        typeof result[key] === 'object' && !Array.isArray(result[key]) &&
        typeof target[key] === 'object' && !Array.isArray(target[key])
      ) {
        result[key] = deepMerge(target[key], result[key]);
      }
    }
  }

  return sanitizeLocalizedFields(result);
}

/**
 * Utility to sanitize persisted page configurations loaded from localStorage.
 * Converts raw translation keys to human-readable Arabic text while preserving
 * 100% of user-customized edits and section ordering.
 */
export function sanitizeWithInitial<T>(parsed: any, initial: T): T {
  const cleanInitial = resolveTranslationKey(initial) as T;
  if (!parsed || typeof parsed !== 'object') return sanitizeLocalizedFields(cleanInitial);

  const cleanParsed = resolveTranslationKey(parsed);

  if (Array.isArray(cleanInitial)) {
    if (!Array.isArray(cleanParsed)) return sanitizeLocalizedFields(cleanInitial);
    return sanitizeLocalizedFields(deepMerge(cleanInitial, cleanParsed)) as T;
  }

  return sanitizeLocalizedFields(deepMerge(cleanInitial, cleanParsed)) as T;
}
