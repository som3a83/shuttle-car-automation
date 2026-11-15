# INSTALLATION GUIDE — SHUTTLE CAR AUTOMATION SYSTEM

## الحالة الحالية

هذا المستودع لا يحتوي حاليًا على شجرة مصدر تطبيق قابلة للتشغيل؛ يحتوي على `shuttle-control-v4.0.0.zip` وملفات توثيق للمراجعة. لم يتم التحقق من أعضاء ZIP أو استخراجها في بيئة الجلسة، لذلك لا يمكن تحديد إطار العمل أو أمر بدء التطبيق، ولا توجد حاليًا APK/AAB جاهزة للتثبيت.

**لا تتبع أوامر تشغيل تخمينية ولا تثبّت ملفات تنفيذية من الأرشيف قبل التحقق منه.** الخطوات التالية تُنزّل المشروع وتتحقق من الأرشيف وتستخرجه فقط؛ ولا تدعي بناء التطبيق.

## المتطلبات

- Git.
- Python 3.
- صلاحية وصول إلى المستودع الخاص `som3a83/shuttle-car-automation`، عبر Git Credential Manager أو SSH. لا تضع رمز الوصول في الأمر أو سجل الطرفية.

## تنزيل فرع التطوير

```bash
git clone --branch development/v4-industrial-upgrade https://github.com/som3a83/shuttle-car-automation.git
cd shuttle-car-automation
```

إذا كنت قد نسخت المستودع مسبقًا، تأكد أنك على فرع التطوير قبل متابعة العمل:

```bash
git switch development/v4-industrial-upgrade
git status --short --branch
```

لا تنفذ أوامر على `main` لهذا الإجراء. احتفظ بنسخة مستقلة من المجلد إذا كان لديك تغييرات محلية.

## فحص ZIP واستخراجه بأمان إلى مجلد جديد

يشغّل هذا الإجراء مدققًا من مكتبة Python القياسية. يتحقق من سلامة أعضاء ZIP عبر CRC، ويرفض المسارات المطلقة وعبور المجلدات والروابط الرمزية والمسارات ذات الفواصل أو جذور الأقراص غير المحمولة، ثم يستخرج إلى مجلد جديد لا يستبدل مجلدًا قائمًا.

شغّله من جذر المستودع:

```bash
python3 - <<'PY'
from pathlib import Path, PurePosixPath
from zipfile import ZipFile
import stat

archive = Path("shuttle-control-v4.0.0.zip")
target = Path("../shuttle-v4-validated")
if not archive.is_file():
    raise SystemExit(f"Archive not found: {archive}")
if target.exists():
    raise SystemExit(f"Refusing to overwrite existing directory: {target}")
target.mkdir(mode=0o700, parents=True)
try:
    with ZipFile(archive) as zf:
        bad = zf.testzip()
        if bad:
            raise SystemExit(f"CRC failure in archive member: {bad}")
        members = zf.infolist()
        for info in members:
            name = info.filename
            path = PurePosixPath(name)
            mode = info.external_attr >> 16
            if path.is_absolute() or ".." in path.parts or not path.parts:
                raise SystemExit(f"Unsafe archive path: {name!r}")
            if "\\" in name or (len(name) > 1 and name[1] == ":"):
                raise SystemExit(f"Non-portable / rooted archive path: {name!r}")
            if stat.S_ISLNK(mode):
                raise SystemExit(f"Symlink member rejected: {name!r}")
        for info in members:
            print(info.filename)
        zf.extractall(target)
except Exception:
    # Keep any partially-created output for manual inspection; never overwrite it.
    raise
print(f"Validated extraction completed in: {target.resolve()}")
PY
```

راجِع قائمة الملفات المستخرجة وتأكد يدويًا من أنها المصدر المتوقع. هذا الفحص لا يثبت أن الكود موثوق أو آمن، ولا يفحص الأسرار أو الثغرات.

## تشغيل التطبيق

لا يوجد أمر تشغيل موثق أو manifest ظاهر في المستودع الحالي، لذلك لا يمكن إعطاء أوامر دقيقة مثل `npm install` أو `gradle assemble` دون معرفة محتوى المصدر. بعد الاستخراج:

1. حدّد مجلد المشروع الذي يحتوي ملفات الإعداد الفعلية.
2. راجع README وملفات الاعتماديات وسكربتات التشغيل قبل تثبيت أي اعتماديات.
3. افحص المحتوى بحثًا عن مفاتيح أو بيانات حساسة قبل مشاركة الملفات أو رفعها.
4. اتبع تعليمات الإطار الفعلية الموجودة في المصدر، ولا تستخدم بيانات اعتماد الإنتاج.
5. نفّذ الاختبارات والبناء في بيئة مناسبة، وسجّل النتائج والأخطاء الفعلية.

لا توصّل التطبيق بمركبة أو PLC/معدات فعلية قبل مراجعة وثائق الشركة المصنّعة، والصلاحيات، وآليات الإيقاف الآمن واختبارها بواسطة مختصين. لم يتم التحقق من اتصال أجهزة أو أوامر حركة في هذه المراجعة.

## Android APK/AAB

لا توجد حزمة APK أو AAB مُنشأة أو مُتحقق منها في المستودع. لا يمكن تثبيت التطبيق على Android أو إصدار أوامر Gradle موثوقة حتى يثبت أن المصدر يتضمن مشروع Android وإعدادات بناء سليمة. إذا أمكن البناء لاحقًا:

- اختبر APK تجريبية غير موقعة/موقعة للاختبار وفق إعدادات المشروع، وتحقق منها على جهاز أو محاكي مناسب.
- احتفظ بمفاتيح التوقيع وكلمات المرور خارج المستودع وسجلات CI.
- أنشئ AAB للنشر فقط بعد استكمال مراجعة واختبارات الإصدار.

## ملفات التسليم

الحالة الحالية لا تتضمن `SHUTTLE_CAR_AUTOMATION_FINAL.zip` أو `SHUTTLE_CAR_AUTOMATION.apk` أو `SHUTTLE_CAR_AUTOMATION.aab`. لا تعتبر هذه الملفات متاحة للتنزيل حتى تُنشأ من المصدر وتُختبر فعليًا ويُرفع ملفها الثنائي إلى إصدار أو Artifact موثوق.
