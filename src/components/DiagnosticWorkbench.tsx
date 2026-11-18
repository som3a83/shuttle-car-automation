import React, { useMemo, useState } from 'react';
import type { Language, Shuttle } from '../types';
import './DiagnosticWorkbench.css';

type SymptomKey = 'wooden-pallet' | 'battery-drain' | 'false-alarm' | 'wheel-slip' | 'sensor-cutout' | 'sudden-stop';

type Check = { en: string; ar: string };
type DiagnosticPath = {
  title: string;
  titleAr: string;
  hypotheses: string;
  hypothesesAr: string;
  checks: Check[];
};

const PATHS: Record<SymptomKey, DiagnosticPath> = {
  'wooden-pallet': {
    title: 'Wooden pallet not detected',
    titleAr: 'عدم اكتشاف الطبالي الخشبية',
    hypotheses: 'Sensor contamination or alignment, pallet geometry/condition, detection threshold, or an unsuitable test sample.',
    hypothesesAr: 'اتساخ الحساس أو عدم محاذاته، أبعاد أو حالة الطبالي، حدود الاكتشاف، أو استخدام عينة اختبار غير مناسبة.',
    checks: [
      { en: 'Record pallet type, dimensions, condition and load before testing.', ar: 'سجّل نوع الطبلية وأبعادها وحالتها والحمولة قبل الاختبار.' },
      { en: 'Inspect sensor lens, mounting, cable and detection field without changing calibration.', ar: 'افحص عدسة الحساس وتثبيته والكابل ومجال الكشف دون تغيير المعايرة.' },
      { en: 'Compare a known-good wooden pallet with an approved reference pallet.', ar: 'قارن طبلية خشبية معروفة السلامة بطبلية مرجعية معتمدة.' },
      { en: 'Capture the event/alarm code and exact operating conditions.', ar: 'سجّل كود الحدث أو الإنذار وظروف التشغيل بدقة.' }
    ]
  },
  'battery-drain': {
    title: 'Rapid battery discharge',
    titleAr: 'استنزاف البطارية بسرعة',
    hypotheses: 'Battery condition, charger performance, drivetrain load, temperature, duty cycle, or an inaccurate manual reading.',
    hypothesesAr: 'حالة البطارية، أداء الشاحن، حمل منظومة الحركة، درجة الحرارة، دورة التشغيل، أو قراءة يدوية غير دقيقة.',
    checks: [
      { en: 'Identify the battery and charger by their physical labels; do not assume ratings.', ar: 'حدّد البطارية والشاحن من لوحات البيانات الفعلية ولا تفترض القيم الاسمية.' },
      { en: 'Record start/end voltage and current using an approved calibrated instrument.', ar: 'سجّل الجهد والتيار في بداية ونهاية الاختبار بأداة معايرة معتمدة.' },
      { en: 'Compare discharge duration under a repeatable load and ambient temperature.', ar: 'قارن زمن التفريغ تحت حمل ودرجة حرارة محيطة قابلين للتكرار.' },
      { en: 'Inspect connector heating, visible damage and charger fault history.', ar: 'افحص سخونة الموصلات والتلف الظاهر وسجل أعطال الشاحن.' }
    ]
  },
  'false-alarm': {
    title: 'Repeated false alarms',
    titleAr: 'إنذارات كاذبة متكررة',
    hypotheses: 'Sensor contamination, vibration, unstable mounting, electrical interference, threshold configuration, or event-log interpretation.',
    hypothesesAr: 'اتساخ الحساس، الاهتزاز، عدم ثبات التثبيت، تداخل كهربائي، إعدادات حدود الكشف، أو تفسير سجل الأحداث.',
    checks: [
      { en: 'Record the exact alarm code, timestamp and operating state.', ar: 'سجّل كود الإنذار ووقته وحالة التشغيل وقت ظهوره.' },
      { en: 'Inspect sensor mounting, cleanliness and cable strain.', ar: 'افحص تثبيت الحساس ونظافته وإجهاد الكابل.' },
      { en: 'Check whether alarms correlate with vibration, movement or nearby equipment.', ar: 'تحقق من ارتباط الإنذارات بالاهتزاز أو الحركة أو المعدات المجاورة.' },
      { en: 'Compare event logs with a controlled, approved test; do not raise safety thresholds.', ar: 'قارن سجل الأحداث باختبار مضبوط ومعتمد ولا ترفع حدود الأمان.' }
    ]
  },
  'wheel-slip': {
    title: 'Wheel slip on cold-room floor',
    titleAr: 'انزلاق العجلات على أرضية التبريد',
    hypotheses: 'Ice or moisture, wheel wear, bearing drag, load distribution, floor condition, or traction-control settings.',
    hypothesesAr: 'ثلج أو رطوبة، تآكل العجلات، مقاومة المحامل، توزيع الحمولة، حالة الأرضية، أو إعدادات التحكم في الجر.',
    checks: [
      { en: 'Stop operation and secure the area if traction is insufficient.', ar: 'أوقف التشغيل وأمّن المنطقة إذا كان التماسك غير كافٍ.' },
      { en: 'Inspect floor for ice, condensation, residue and uneven surfaces.', ar: 'افحص الأرضية بحثًا عن الثلج والتكاثف والرواسب وعدم الاستواء.' },
      { en: 'Inspect wheel tread, bearing noise and visible mechanical damage.', ar: 'افحص نقشة العجلة وصوت المحامل وأي تلف ميكانيكي ظاهر.' },
      { en: 'Record load, route, speed setting and environmental conditions.', ar: 'سجّل الحمولة والمسار وإعداد السرعة والظروف البيئية.' }
    ]
  },
  'sensor-cutout': {
    title: 'Intermittent sensor cut-out',
    titleAr: 'فصل متقطع للحساسات',
    hypotheses: 'Loose connector, cable damage, power instability, moisture ingress, electromagnetic interference, or sensor failure.',
    hypothesesAr: 'موصل غير محكم، تلف الكابل، عدم استقرار التغذية، دخول رطوبة، تداخل كهرومغناطيسي، أو عطل بالحساس.',
    checks: [
      { en: 'Record affected sensor, fault code and whether the issue is repeatable.', ar: 'سجّل الحساس المتأثر وكود العطل وهل يمكن تكرار المشكلة.' },
      { en: 'Visually inspect connectors, cable routing, strain relief and moisture traces.', ar: 'افحص بصريًا الموصلات ومسار الكابل ووسائل تخفيف الشد وآثار الرطوبة.' },
      { en: 'Review approved power and signal diagnostics with a qualified technician.', ar: 'راجع تشخيص التغذية والإشارة المعتمد مع فني مؤهل.' },
      { en: 'Do not bypass, bridge or disable a safety sensor to keep the shuttle running.', ar: 'لا تتجاوز الحساسات أو تجسرها أو تعطلها لاستمرار تشغيل الشاتل.' }
    ]
  },
  'sudden-stop': {
    title: 'Unexpected shuttle stop',
    titleAr: 'توقف مفاجئ للشاتل',
    hypotheses: 'Safety interlock, obstacle detection, power interruption, communication watchdog, drive protection, or a mechanical obstruction.',
    hypothesesAr: 'دائرة أمان، اكتشاف عائق، انقطاع التغذية، مراقب الاتصال، حماية منظومة الحركة، أو عائق ميكانيكي.',
    checks: [
      { en: 'Keep the equipment stopped and follow the site isolation procedure.', ar: 'اترك المعدة متوقفة واتبع إجراء العزل المعتمد بالموقع.' },
      { en: 'Capture the exact time, operating mode, load and displayed alarm.', ar: 'سجّل التوقيت الدقيق ووضع التشغيل والحمولة والإنذار الظاهر.' },
      { en: 'Inspect the travel path and visible obstructions from a safe position.', ar: 'افحص مسار الحركة والعوائق الظاهرة من موضع آمن.' },
      { en: 'Have an authorized technician review interlock, drive and communication logs.', ar: 'اطلب من فني مخول مراجعة سجلات الأمان والحركة والاتصال.' }
    ]
  }
};

const SYMPTOMS: { id: SymptomKey; en: string; ar: string }[] = [
  { id: 'wooden-pallet', en: 'Wooden pallet not detected', ar: 'عدم اكتشاف الطبلية الخشبية' },
  { id: 'battery-drain', en: 'Rapid battery discharge', ar: 'استنزاف البطارية بسرعة' },
  { id: 'false-alarm', en: 'Repeated false alarms', ar: 'إنذارات كاذبة متكررة' },
  { id: 'wheel-slip', en: 'Wheel slip on cold-room floor', ar: 'انزلاق العجلات على أرضية التبريد' },
  { id: 'sensor-cutout', en: 'Intermittent sensor cut-out', ar: 'فصل متقطع للحساسات' },
  { id: 'sudden-stop', en: 'Unexpected shuttle stop', ar: 'توقف مفاجئ للشاتل' }
];

export default function DiagnosticWorkbench({ language, shuttles }: { language: Language; shuttles: Shuttle[] }) {
  const ar = language === 'ar';
  const [shuttleId, setShuttleId] = useState(shuttles[0]?.id ?? '');
  const [symptom, setSymptom] = useState<SymptomKey>('wooden-pallet');
  const [checked, setChecked] = useState<string[]>([]);
  const [findings, setFindings] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'unavailable'>('idle');
  const path = PATHS[symptom];
  const selected = shuttles.find((item) => item.id === shuttleId) ?? shuttles[0];
  const progress = useMemo(() => path.checks.filter((_, index) => checked.includes(String(index))).length, [path, checked]);

  const changeSymptom = (value: SymptomKey) => {
    setSymptom(value);
    setChecked([]);
    setFindings('');
    setCopyState('idle');
  };

  const copyReport = async () => {
    const report = [
      'SHUTTLE CAR — FIELD INSPECTION NOTES',
      `Asset: ${selected?.id ?? 'Not selected'} · ${selected?.manufacturer ?? 'Unknown'} · ${selected?.model ?? 'Not recorded'}`,
      `Observed symptom: ${ar ? SYMPTOMS.find((item) => item.id === symptom)?.ar : path.title}`,
      `Hypotheses requiring technical verification: ${ar ? path.hypothesesAr : path.hypotheses}`,
      ...path.checks.map((item, index) => `[${checked.includes(String(index)) ? 'x' : ' '}] ${ar ? item.ar : item.en}`),
      `Field findings: ${findings.trim() || 'Not recorded'}`,
      'This is a rule-based checklist, not an AI diagnosis or a machine command.'
    ].join('\n');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(report);
      setCopyState('copied');
    } catch {
      setCopyState('unavailable');
    }
  };

  return <section className="diagnostic-workbench" aria-label={ar ? 'مساحة الفحص الفني' : 'Technical diagnostic workbench'}>
    <div className="diagnostic-workbench-header">
      <div>
        <span className="eyebrow">{ar ? 'دعم فني محلي / مسار فحص إرشادي' : 'LOCAL ENGINEERING SUPPORT / GUIDED INSPECTION'}</span>
        <h2>{ar ? 'مساحة الفحص والتشخيص' : 'Diagnostic workbench'}</h2>
        <p>{ar ? 'اختر المعدة والعَرَض لتجهيز قائمة فحص منظمة وتوثيق الملاحظات الميدانية.' : 'Select an asset and observed symptom to build a structured inspection checklist and capture field notes.'}</p>
      </div>
      <span className="diagnostic-mode">{ar ? 'قواعد محلية · ليس ذكاءً اصطناعيًا' : 'RULE-BASED · NOT AI GENERATED'}</span>
    </div>

    <div className="diagnostic-selectors">
      <label>{ar ? 'الشاتل' : 'Shuttle asset'}
        <select aria-label={ar ? 'الشاتل' : 'Shuttle asset'} value={selected?.id ?? ''} onChange={(event) => setShuttleId(event.target.value)}>
          {shuttles.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.manufacturer} · {item.model}</option>)}
        </select>
      </label>
      <label>{ar ? 'العَرَض المُلاحظ' : 'Observed symptom'}
        <select aria-label={ar ? 'العَرَض المُلاحظ' : 'Observed symptom'} value={symptom} onChange={(event) => changeSymptom(event.target.value as SymptomKey)}>
          {SYMPTOMS.map((item) => <option key={item.id} value={item.id}>{ar ? item.ar : item.en}</option>)}
        </select>
      </label>
    </div>

    <div className="diagnostic-asset-strip">
      <div><small>{ar ? 'المعدة المختارة' : 'SELECTED ASSET'}</small><strong>{selected?.id ?? (ar ? 'غير محدد' : 'Not selected')}</strong></div>
      <div><small>{ar ? 'الشركة المصنعة' : 'MANUFACTURER'}</small><strong>{selected?.manufacturer ?? '—'}</strong></div>
      <div><small>{ar ? 'الموديل' : 'MODEL'}</small><strong>{selected?.model ?? (ar ? 'غير مسجل' : 'Not recorded')}</strong></div>
      <div><small>{ar ? 'حالة التشغيل المسجلة' : 'RECORDED STATE'}</small><strong>{selected?.status ?? 'Unknown'}</strong></div>
    </div>

    <div className="diagnostic-hypothesis">
      <span>{ar ? 'فرضيات للفحص — تحتاج تحققًا فنيًا' : 'INVESTIGATION HYPOTHESES — TECHNICAL VERIFICATION REQUIRED'}</span>
      <p>{ar ? path.hypothesesAr : path.hypotheses}</p>
    </div>

    <div className="diagnostic-checklist">
      <div className="diagnostic-checklist-heading">
        <div><span className="eyebrow">{ar ? 'خطوات الفحص' : 'INSPECTION STEPS'}</span><h3>{ar ? path.titleAr : path.title}</h3></div>
        <strong>{progress} / {path.checks.length}</strong>
      </div>
      <div className="diagnostic-progress"><span style={{ width: `${(progress / path.checks.length) * 100}%` }}/></div>
      {path.checks.map((item, index) => <label className="diagnostic-check" key={index}>
        <input type="checkbox" checked={checked.includes(String(index))} onChange={(event) => setChecked((current) => event.target.checked ? [...current, String(index)] : current.filter((value) => value !== String(index)))}/>
        <span className="diagnostic-check-number">{String(index + 1).padStart(2, '0')}</span>
        <span>{ar ? item.ar : item.en}</span>
      </label>)}
    </div>

    <label className="diagnostic-findings">{ar ? 'الملاحظات والنتائج الميدانية' : 'Field findings and measurements'}
      <textarea value={findings} onChange={(event) => setFindings(event.target.value)} rows={4} placeholder={ar ? 'اكتب كود الإنذار، وقت حدوثه، ظروف التشغيل، ونتائج الفحص...' : 'Record alarm codes, timestamps, operating conditions and inspection results...'}/>
    </label>

    <div className="diagnostic-actions">
      <button type="button" className="btn-secondary" onClick={() => { setChecked([]); setFindings(''); setCopyState('idle'); }}>{ar ? 'إعادة ضبط القائمة' : 'Reset checklist'}</button>
      <button type="button" className="btn-primary" onClick={() => void copyReport()}>{ar ? 'نسخ تقرير الفحص' : 'Copy inspection report'}</button>
      <span role="status" aria-live="polite">{copyState === 'copied' ? (ar ? 'تم نسخ التقرير' : 'Report copied') : copyState === 'unavailable' ? (ar ? 'النسخ غير متاح على هذا الجهاز' : 'Clipboard is unavailable on this device') : ''}</span>
    </div>

    <div className="diagnostic-safety-note"><strong>{ar ? 'تنبيه سلامة' : 'SAFETY NOTICE'}</strong><p>{ar ? 'هذه قائمة فحص إرشادية وليست تشخيصًا أو تعليمات إصلاح معتمدة. لا تتجاوز دوائر الأمان ولا تفك البطارية أو تعدّل إعدادات المصنع. أوقف المعدة واعزلها عند وجود خطر، واتبع دليل الشركة وإجراءات الموقع بواسطة فني مخول.' : 'This is a guided checklist, not a diagnosis or an approved repair procedure. Never bypass safety circuits, open battery packs or change OEM settings. Stop and isolate equipment when unsafe, and follow the manufacturer procedure and site rules through an authorized technician.'}</p></div>
    <p className="diagnostic-disclaimer">{ar ? 'المحتوى يعمل محليًا داخل التطبيق. لا يوجد مزود ذكاء اصطناعي متصل، ولا يتم إرسال أوامر أو تغييرات إلى الشاتل.' : 'This workbench runs locally in the app. No AI provider is connected, and it sends no commands or changes to the shuttle.'}</p>
  </section>;
}
