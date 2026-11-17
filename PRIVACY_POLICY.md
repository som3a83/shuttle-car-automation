# Privacy Policy — Shuttle Car Automation

**Effective date:** 17 November 2026  
**Application ID:** `com.shuttlecar.automation`

## العربية

### 1. الجهة المسؤولة والتواصل
تُدار سياسة الخصوصية الخاصة بالتطبيق بواسطة ناشر مشروع Shuttle Car Automation. للاستفسارات العامة افتح issue دون إدخال بيانات شخصية أو سجلات تشغيلية أو أسرار. لا ترفق ملفات تصدير أو بيانات موظفين في issue عام. للإبلاغ عن ثغرة أمنية استخدم نموذج البلاغ الخاص:  
https://github.com/som3a83/shuttle-car-automation/security/advisories/new  
لا توجد نسخة خادم من سجلات التطبيق لدى الناشر في هذا الإصدار؛ حذف البيانات يتم من الجهاز نفسه بمسح بيانات التطبيق من إعدادات Android.

### 2. طبيعة التطبيق
التطبيق يعمل محليًا لإدارة السجلات، ويتيح اختياريًا الاتصال عبر HTTPS ببوابة OT منفصلة ومصرح بها لقراءة القياسات فقط. لا يوجد اتصال مباشر من الهاتف بوحدات PLC، ولا يحتوي التطبيق على أوامر حركة أو تحكم. لا توجد حسابات خادم أو مزامنة سحابية.

### 3. المعلومات التي قد تدخلها بنفسك
قد يحتوي السجل المحلي على معرفات المعدات، الشركة المصنعة والموديل والأرقام التسلسلية التي تدخلها، مناطق التشغيل، أسماء المشرفين والمشغلين والفنيين، حالات التشغيل، قراءات البطاريات التي تدخلها يدويًا، ملاحظات الأعطال والصيانة، سجلات الورديات، والتفضيلات.

قد تتضمن أسماء العاملين معلومات شخصية. لا تُدخل كلمات مرور أو مفاتيح API أو بيانات اعتماد أو أسرارًا صناعية حساسة في حقول التطبيق.

### 4. مكان التخزين والنقل
تُحفظ السجلات التشغيلية المحلية في مساحة التخزين المحلية للتطبيق/متصفح الجهاز الحالي. **لا يرسل التطبيق هذه السجلات إلى خادم تابع للناشر ولا توجد مزامنة سحابية.** عند تفعيل بوابة OT اختياريًا، يرسل التطبيق رمز القراءة مباشرة إلى عنوان البوابة المحدد عبر HTTPS ويطلب نقاط القراءة المخصصة فقط؛ لا يرسل سجل المعدات المحلي إليها. يبقى رمز القراءة في ذاكرة الشاشة ولا يُحفظ في localStorage. يتولى مشغل البوابة بالمصنع إدارة سجلات القياس ومدة الاحتفاظ بها. لا يتضمن التطبيق إعلانات أو أدوات تحليل استخدام أو تتبع مدمجة.

التخزين المحلي في هذا الإصدار ليس تشفيرًا تطبيقيًا متخصصًا. احمِ جهازك بقفل شاشة مناسب، ولا تستخدم التطبيق لتخزين أسرار أو بيانات تشغيلية مصنفة أو شديدة الحساسية.

### 5. الروابط الخارجية
قد يفتح التطبيق مواقع الشركات المصنعة أو صفحات GitHub عند اختيار المستخدم للرابط. تتعامل هذه المواقع مع بيانات الاتصال العادية وفق سياساتها الخاصة. لا يرسل التطبيق سجلات المعدات المحلية أو أسماء العاملين عند فتح الرابط.

### 6. النسخ الاحتياطي والتصدير
يمكن للمستخدم تصدير بعض السجلات إلى ملفات JSON أو CSV أو XLSX وطباعتها أو حفظها كـ PDF من خلال وظيفة الطباعة في الجهاز. بعد التصدير تصبح نسخة الملف تحت سيطرة المستخدم، وقد تحتوي على أسماء وملاحظات وبيانات معدات. احفظها في مكان آمن ولا تشاركها إلا مع أشخاص مخولين.

### 7. الاحتفاظ والحذف
تظل البيانات المحلية على الجهاز إلى أن يحذفها المستخدم أو يمسح بيانات التطبيق أو يزيل التطبيق. قد تعيد وظيفة إعادة الضبط سجلات البداية بدلًا من حذف كل المحتوى بصورة آمنة؛ لذلك استخدم إعدادات نظام Android لمسح بيانات التطبيق عند الرغبة في إزالة البيانات المحلية. لا توجد نسخة سحابية لدى ناشر التطبيق في هذا الإصدار.

### 8. الأطفال
التطبيق أداة تشغيلية مهنية وليس موجّهًا للأطفال.

### 9. التغييرات
قد تُحدّث هذه السياسة عند إضافة خادم أو مزامنة أو تحليلات أو تكاملات خارجية. ستوضح النسخة المحدثة أنواع البيانات والغرض منها قبل اعتماد هذه الوظائف.

## English

### 1. Publisher and contact
This policy applies to the current Shuttle Car Automation application published from the project repository. For general support, use a GitHub issue without including personal data, staff records, exports or confidential operating details:  
https://github.com/som3a83/shuttle-car-automation/issues  
For a security vulnerability, use the private security advisory form:  
https://github.com/som3a83/shuttle-car-automation/security/advisories/new  
This release keeps records only on the device; deletion is performed locally by clearing the app storage in Android settings. The publisher does not hold a server-side copy.

### 2. What this application does
The application is a device-local tool for recording shuttle fleet, battery, fault, maintenance, shift and report information. It optionally connects over HTTPS to a separately operated, authorized OT edge gateway to read telemetry. The mobile app does not connect directly to PLCs and does not provide machine-control commands, user accounts on a server, or cloud synchronization.

### 3. Information entered by the user
Local records may contain equipment identifiers, manufacturer/model/serial details entered by the user, operating zones, supervisor/operator/technician names, operating states, manually entered battery readings, fault and maintenance notes, shift records and preferences.

Names may be personal information. Do not enter passwords, API keys, credentials or industrial secrets into the application.

### 4. Storage and sharing
Operational records are stored in local application/browser storage on the current device. **The app does not transmit those records to a publisher-operated server and does not synchronize them to the cloud.** When the optional OT gateway connection is configured, the app sends the read token directly to the user-selected gateway over HTTPS and requests read-only telemetry endpoints; it does not upload the local equipment register to that gateway. The read token is held in screen memory and is not persisted to localStorage. The plant gateway operator controls its telemetry retention. The app includes no in-app advertising, usage analytics or tracking.

This release does not provide application-level encryption for local records. Protect the device with an appropriate screen lock and do not use the app to store secrets or highly sensitive classified operational data.

### 5. External links
The app may open manufacturer websites or GitHub pages when the user selects an external link. Those sites process normal connection metadata under their own privacy policies. The app does not attach local equipment records or staff names when opening a link.

### 6. Backups and exports
Users may export records to JSON, CSV or XLSX files, or use the device print function to save a PDF. Exported files are controlled by the user and may contain names, notes and equipment information. Store them securely and share them only with authorized people.

### 7. Retention and deletion
Local data remains on the device until the user deletes it, clears the application's storage, or uninstalls the application. The in-app reset function restores seed records and is not a secure-erasure function. To remove local data, use Android system settings to clear the application's storage. The publisher does not hold a cloud copy in this release.

### 8. Children
This is a professional operational utility and is not directed to children.

### 9. Policy changes
This policy will be revised if publisher-operated backend services, cloud synchronization, analytics or additional external integrations are introduced. The optional plant OT gateway described above is separately operated by the plant and requires its own access and retention controls.
