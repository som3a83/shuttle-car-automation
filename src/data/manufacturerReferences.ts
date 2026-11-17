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
      en: 'ISAT pallet shuttle satellite — reference family',
      ar: 'عائلة ISAT Pallet Shuttle — مرجع هندسي'
    },
    description: {
      en: 'Cassioli describes ISAT satellites for multi-depth pallet storage. The page states that the shuttle independently picks and places unit loads and uses sensors to show its position. Four-way and AWDS configurations are listed as product options; the exact configuration on SC-01 to SC-03 is not verified.',
      ar: 'تعرض كاسيولي وحدات ISAT للتخزين العميق متعدد الطبالي. وتوضح الصفحة أن الشاتل يلتقط وحدات التحميل ويضعها بصورة مستقلة، مع حساسات لعرض موضع الجهاز. كما تذكر خيارات 4-Way وAWDS، لكن تجهيز الأجهزة SC-01 إلى SC-03 لم يتم التحقق منه.'
    },
    facts: [
      { en: 'Multi-depth pallet storage and independent load handling', ar: 'تخزين متعدد الأعماق ومناولة مستقلة لوحدات التحميل' },
      { en: 'Position sensors are described on the ISAT product page', ar: 'صفحة ISAT تذكر حساسات لتحديد موضع الشاتل' },
      { en: 'Four-way shuttle and AWDS are listed options, not confirmed on this fleet', ar: 'الشاتل رباعي الاتجاهات وAWDS خيارات منشورة وليسا مواصفتين مؤكدتين للأسطول' }
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
      en: 'Namla Radio Shuttle — official product reference',
      ar: 'Namla Radio Shuttle — مرجع المنتج الرسمي'
    },
    description: {
      en: 'ACME describes Namla as a semi-automated AS/RS shuttle that moves pallets inside rack channels. The product page states lithium-battery power, integrated controls, a remote for the forklift operator and support for different pallet types.',
      ar: 'تصف ACME جهاز Namla بأنه شاتل شبه آلي ينقل الطبالي داخل قنوات الأرفف. وتذكر صفحة المنتج بطارية ليثيوم ووحدات تحكم مدمجة وريموت لمشغل الرافعة ودعم أنواع مختلفة من الطبالي.'
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
    scopeLabel: { en: 'Official product page · installed variant unverified', ar: 'صفحة منتج رسمية · الإصدار المركب غير مؤكد' }
  },
  Craftsman: {
    manufacturer: 'Craftsman',
    productFamily: {
      en: 'Cold Storage Automation — system-level reference',
      ar: 'Cold Storage Automation — مرجع على مستوى النظام'
    },
    description: {
      en: 'The supplied Craftsman page describes cold-storage automation rather than a specific shuttle-car model. It discusses low-temperature system capability down to -30°C and below, plus a multi-deep shuttle AS/RS arrangement communicating with Shuttle Fleet Management Software (SFMS). These are system-level statements, not a confirmed rating or feature list for SC-04.',
      ar: 'صفحة كرافتسمان المرفقة تعرض أتمتة التخزين البارد عمومًا، وليست صفحة مواصفات موديل شاتل بعينه. وتذكر قدرة بعض حلول النظام على العمل حتى ‎-30°C وأقل، كما تعرض نظام Shuttle متعدد الأعماق يتواصل مع برنامج إدارة أسطول الشاتلات SFMS. هذه معلومات على مستوى الحل وليست اعتمادًا مؤكدًا للجهاز SC-04.'
    },
    facts: [
      { en: 'Cold-chain automation and low-temperature system design', ar: 'أتمتة سلسلة التبريد وتصميم أنظمة لدرجات الحرارة المنخفضة' },
      { en: 'The page cites capability down to -30°C and below at solution level', ar: 'الصفحة تذكر قدرة حلول النظام حتى ‎-30°C وأقل' },
      { en: 'Multi-deep shuttle AS/RS with SFMS communication is described', ar: 'تصف الصفحة نظام Shuttle متعدد الأعماق مع اتصال ببرنامج SFMS' }
    ],
    coldStoreNote: {
      en: 'The -30°C statement applies to the described solution range, not automatically to this individual shuttle. Confirm the vehicle, battery, sensors and charger ratings from its own documentation.',
      ar: 'ذكر ‎-30°C يخص نطاق الحلول المعروضة ولا ينطبق تلقائيًا على هذه الشاتل بعينها. يجب تأكيد تصنيف الشاتل والبطارية والحساسات والشاحن من مستندات الجهاز نفسه.'
    },
    sourceUrl: 'https://www.craftsmanstorage.com/cold-storage-automation',
    sourceLabel: { en: 'Open Craftsman cold-storage reference', ar: 'فتح مرجع كرافتسمان للتخزين البارد' },
    scopeLabel: { en: 'Cold-storage solution page · not an individual shuttle datasheet', ar: 'صفحة حلول التخزين البارد · ليست ورقة بيانات للشاتل' }
  }
};

export function getManufacturerReference(manufacturer: string): ManufacturerReference | null {
  return references[manufacturer] ?? null;
}
