export interface ManufacturerReference {
  manufacturer: string;
  productFamily: { en: string; ar: string };
  description: { en: string; ar: string };
  facts: Array<{ en: string; ar: string }>;
  coldStoreNote: { en: string; ar: string };
  sourceUrl: string;
  sourceLabel: { en: string; ar: string };
  scopeLabel: { en: string; ar: string };
}

const references: Record<string, ManufacturerReference> = {
  Cassioli: {
    manufacturer: 'Cassioli',
    productFamily: {
      en: 'ISAT Semi-Automatic pallet shuttle — user-confirmed fleet model',
      ar: 'ISAT Semi-Automatic — الموديل المؤكد للأسطول'
    },
    description: {
      en: 'The user confirmed that SC-01 to SC-03 are ISAT Semi-Automatic units. They are described for remote operation and forklift transfer between aisles. Cassioli product options and the exact serial-specific hardware configuration still require documentary verification.',
      ar: 'أكد المستخدم أن الأجهزة SC-01 إلى SC-03 من طراز ISAT Semi-Automatic، وتعمل بالريموت مع نقلها بين الممرات بواسطة الرافعة الشوكية. تظل التجهيزات الدقيقة لكل رقم مسلسل بحاجة إلى مستندات تحقق.'
    },
    facts: [
      { en: 'Semi-automatic operation; remote control and forklift transfer between aisles are user-confirmed for this fleet', ar: 'تشغيل شبه آلي بالريموت مع نقل الشاتل بين الممرات بالرافعة الشوكية — وفق تأكيد المستخدم' },
      { en: 'Position sensors are described on the ISAT product page', ar: 'صفحة ISAT تذكر حساسات لتحديد موضع الشاتل' },
      { en: 'Standard and cold-store variants are referenced in supplied specifications; the installed temperature-rated variant is not yet verified', ar: 'المواصفات المقدمة تشير إلى إصدار عادي وآخر للتخزين البارد؛ لم يتم التحقق بعد من إصدار درجة الحرارة المركب فعليًا' }
    ],
    coldStoreNote: {
      en: 'The linked ISAT page does not specify a cold-room temperature rating. Confirm the exact installed model and its approved operating-temperature range with Cassioli.',
      ar: 'صفحة ISAT المرفقة لا تحدد تصنيف درجة حرارة لغرف التجميد. يجب تأكيد الموديل المركب ومدى حرارة التشغيل المعتمد مع كاسيولي.'
    },
    sourceUrl: 'https://www.cassioli.com/intralogistics-division/automated-warehouses/pallet-shuttle/',
    sourceLabel: { en: 'Open Cassioli product reference', ar: 'فتح مرجع منتج كاسيولي' },
    scopeLabel: { en: 'Vendor product-family reference · exact installed model unknown', ar: 'مرجع لعائلة المنتج · الموديل المركب غير معروف' }
  },
  ACME: {
    manufacturer: 'ACME',
    productFamily: {
      en: 'Namla Polar Edition — user-confirmed installed variant',
      ar: 'Namla Polar Edition — الإصدار المركب وفق تأكيد المستخدم'
    },
    description: {
      en: 'The user identified the installed ACME unit as Namla Polar Edition. The linked ACME page describes the Namla family generally; the Polar-specific temperature range and serial-specific configuration must be checked against the unit nameplate or manual.',
      ar: 'حدد المستخدم أن جهاز ACME المركب هو Namla Polar Edition. الصفحة المرتبطة تعرض عائلة Namla عمومًا؛ ويجب مطابقة مدى الحرارة الخاص بإصدار Polar وتجهيز الرقم المسلسل مع لوحة بيانات الجهاز أو دليله.'
    },
    facts: [
      { en: 'Semi-automated pallet movement inside rack channels', ar: 'نقل شبه آلي للطبالي داخل قنوات الأرفف' },
      { en: 'Lithium battery power and integrated controls are stated by ACME', ar: 'تذكر ACME التشغيل ببطارية ليثيوم ووحدات تحكم مدمجة' },
      { en: 'Remote control for the forklift operator; supported pallet types vary', ar: 'ريموت لمشغل الرافعة، وأنواع الطبالي المدعومة متعددة' }
    ],
    coldStoreNote: {
      en: 'The Namla product page does not state a cold-storage temperature rating. Do not assume a low-temperature certification from the product name alone; verify the serial-specific manual and battery limits.',
      ar: 'صفحة Namla لا تذكر تصنيفًا لدرجة حرارة التخزين البارد. لا تفترض وجود اعتماد للعمل في درجات منخفضة من اسم المنتج فقط؛ راجع دليل الرقم المسلسل وحدود البطارية.'
    },
    sourceUrl: 'https://acme-world.com/product/radio-shuttle',
    sourceLabel: { en: 'Open ACME Namla product reference', ar: 'فتح مرجع منتج ACME Namla' },
    scopeLabel: { en: 'User-confirmed installed variant · Polar-specific ratings pending document verification', ar: 'الإصدار المركب وفق تأكيد المستخدم · تصنيفات Polar تنتظر التحقق بالمستندات' }
  },
  Craftsman: {
    manufacturer: 'Craftsman',
    productFamily: {
      en: 'Standard Pallet Shuttle — user-confirmed installed model',
      ar: 'Pallet Shuttle العادي — الموديل المركب وفق تأكيد المستخدم'
    },
    description: {
      en: 'The user confirmed SC-04 is the standard Pallet Shuttle, not a 4-Way Shuttle. The linked Craftsman cold-storage page is a system-level reference, not a datasheet for this exact vehicle. Model code, serial number, installed options and vehicle-specific operating limits remain unverified.',
      ar: 'أكد المستخدم أن SC-04 هو Pallet Shuttle العادي وليس 4-Way Shuttle. صفحة كرافتسمان المرتبطة مرجع لحلول التخزين البارد وليست ورقة بيانات لهذه الوحدة بعينها. لا يزال كود الموديل والرقم المسلسل والتجهيزات وحدود التشغيل الخاصة بالجهاز بحاجة إلى تحقق.'
    },
    facts: [
      { en: 'Cold-chain automation and low-temperature system design', ar: 'أتمتة سلسلة التبريد وتصميم أنظمة لدرجات الحرارة المنخفضة' },
      { en: 'No SC-04-specific temperature rating is established by the linked system page', ar: 'الصفحة الخاصة بالنظام لا تثبت تصنيف درجة حرارة خاصًا بالجهاز SC-04' },
      { en: 'Multi-deep shuttle AS/RS with SFMS communication is described', ar: 'تصف الصفحة نظام Shuttle متعدد الأعماق مع اتصال ببرنامج SFMS' }
    ],
    coldStoreNote: {
      en: 'The -30°C statement applies to the described solution range, not automatically to this individual shuttle. Confirm the vehicle, battery, sensors and charger ratings from its own documentation.',
      ar: 'ذكر ‎-30°C يخص نطاق الحلول المعروضة ولا ينطبق تلقائيًا على هذه الشاتل بعينها. يجب تأكيد تصنيف الشاتل والبطارية والحساسات والشاحن من مستندات الجهاز نفسه.'
    },
    sourceUrl: 'https://www.craftsmanstorage.com/cold-storage-automation',
    sourceLabel: { en: 'Open Craftsman cold-storage reference', ar: 'فتح مرجع كرافتسمان للتخزين البارد' },
    scopeLabel: { en: 'User-confirmed model family · exact vehicle datasheet still required', ar: 'عائلة الموديل وفق تأكيد المستخدم · ما زالت ورقة بيانات الوحدة مطلوبة' }
  }
};

export function getManufacturerReference(manufacturer: string): ManufacturerReference | null {
  return references[manufacturer] ?? null;
}
