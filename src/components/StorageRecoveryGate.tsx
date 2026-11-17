import { useMemo, useState } from 'react';
import './StorageRecoveryGate.css';
import type { OperationalBootstrapResult, OperationalRecoveryItem, OperationalCollection, RecoverySource } from '../security/operationalStorage';
import { bootstrapOperationalStorage, OPERATIONAL_PREFIX, resolveOperationalRecovery } from '../security/operationalStorage';
import { AUDIT_STORAGE_KEY } from '../security/auditLog';

function pretty(value: unknown): string {
  try { return JSON.stringify(value, null, 2) ?? 'null'; }
  catch { return '[Preview unavailable]'; }
}

function collectionLabel(value: OperationalCollection, ar: boolean): string {
  const labels: Record<OperationalCollection, [string, string]> = {
    language: ['Language preference', 'تفضيل اللغة'],
    theme: ['Appearance preference', 'تفضيل المظهر'],
    sidebarCollapsed: ['Sidebar preference', 'تفضيل القائمة الجانبية'],
    shuttles: ['Shuttle fleet register', 'سجل عربات الشاتل'],
    batteries: ['Battery register', 'سجل البطاريات'],
    faults: ['Fault register', 'سجل الأعطال'],
    maintenance: ['Maintenance work orders', 'أوامر الصيانة'],
    connections: ['Device connections', 'اتصالات الأجهزة'],
    notifications: ['Notifications', 'الإشعارات'],
    settings: ['Application settings', 'إعدادات التطبيق'],
    dailyReports: ['Daily reports', 'التقارير اليومية'],
    shifts: ['Shift records', 'سجلات الورديات']
  };
  return labels[value][ar ? 1 : 0];
}

function candidateCount(value: unknown): string {
  if (Array.isArray(value)) return `${value.length} records`;
  if (value && typeof value === 'object') return `${Object.keys(value).length} fields`;
  return typeof value;
}

export default function StorageRecoveryGate({
  initial,
  onRecovered
}: {
  initial: Extract<OperationalBootstrapResult, { status: 'recovery-required' }>;
  onRecovered: () => void;
}) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState<OperationalCollection | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ collection: OperationalCollection; source: RecoverySource } | null>(null);
  const ar = (() => {
    try { return localStorage.getItem(`${OPERATIONAL_PREFIX}language`) === '"ar"'; }
    catch { return false; }
  })();

  const rawKeyCount = useMemo(() => {
    try {
      return Object.keys(localStorage).filter((key) =>
        key.startsWith(OPERATIONAL_PREFIX) || key === AUDIT_STORAGE_KEY
      ).length;
    } catch { return 0; }
  }, []);

  const downloadRawCopies = () => {
    const records: Record<string, string> = {};
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(OPERATIONAL_PREFIX) || key === AUDIT_STORAGE_KEY) {
        const value = localStorage.getItem(key);
        if (value !== null) records[key] = value;
      }
    }
    const blob = new Blob([JSON.stringify({
      format: 'shuttle-car-automation-recovery-export',
      exportedAt: new Date().toISOString(),
      warning: 'Raw local copies for recovery inspection. This file may contain operational data.',
      records
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `shuttle-recovery-raw-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const refreshState = async () => {
    const result = await bootstrapOperationalStorage();
    if (result.status === 'ready') onRecovered();
    else setState(result);
  };

  const resolve = async (item: OperationalRecoveryItem, source: RecoverySource) => {
    setError('');
    if (source !== 'empty' && (preview?.collection !== item.collection || preview.source !== source)) {
      setError(ar
        ? 'عاين النسخة نفسها أولاً قبل اعتمادها أو ترحيلها.'
        : 'Preview the exact recovery candidate before applying this choice.');
      return;
    }
    if (source === 'empty') {
      const accepted = window.confirm(ar
        ? `هل تؤكد بدء سجل فارغ لـ ${collectionLabel(item.collection, true)}؟ سيتم حفظ النسخ الأصلية المعطوبة في العزل قبل التغيير.`
        : `Create an empty register for ${collectionLabel(item.collection, false)}? Original raw copies will be quarantined before any change.`);
      if (!accepted) return;
    }
    setBusy(item.collection);
    try {
      await resolveOperationalRecovery(item.collection, source);
      setPreview(null);
      await refreshState();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (ar ? 'فشل إجراء الاسترداد.' : 'Recovery action failed.'));
    } finally {
      setBusy(null);
    }
  };

  const inspect = (item: OperationalRecoveryItem, source: RecoverySource) => {
    setPreview({ collection: item.collection, source });
  };

  const previewValue = (item: OperationalRecoveryItem, source: RecoverySource): unknown => {
    if (source === 'primary') return item.primaryData;
    if (source === 'previous') return item.previousData;
    if (source === 'legacy') return item.legacyData;
    return [];
  };

  return <main className="storage-recovery-shell" dir={ar ? 'rtl' : 'ltr'}>
    <section className="storage-recovery-header surface-card">
      <span className="eyebrow">DATA INTEGRITY / RECOVERY MODE</span>
      <h1>{ar ? 'وضع استرداد البيانات' : 'Operational Data Recovery'}</h1>
      <p>{ar
        ? 'تم إيقاف تشغيل التطبيق قبل أي حفظ تلقائي. راجع كل سجل واختر النسخة التي تريد استعادتها. لن يتم استبدال البيانات المتضررة بصمت.'
        : 'The application is paused before any automatic save. Review each collection and explicitly choose the source to restore. Damaged data will not be silently replaced.'}</p>
      <div className="storage-recovery-actions">
        <button type="button" className="btn-primary" onClick={downloadRawCopies}>
          {ar ? 'تصدير كل النسخ الخام قبل المتابعة' : 'Export all raw copies before proceeding'}
        </button>
        <span className="muted-text">{rawKeyCount} {ar ? 'مفتاح تخزين محلي' : 'local storage keys available for export'}</span>
      </div>
    </section>

    {error && <div className="security-error" role="alert">{error}</div>}

    <section className="storage-recovery-list">
      {state.items.map((item) => <article className="surface-card storage-recovery-card" key={item.collection}>
        <div className="storage-recovery-card-head">
          <div>
            <span className="eyebrow">{item.collection}</span>
            <h2>{collectionLabel(item.collection, ar)}</h2>
            <p>{item.reason}</p>
          </div>
          <span className="security-state-pill is-guest">{ar ? 'يتطلب قراراً' : 'ACTION REQUIRED'}</span>
        </div>

        <div className="storage-recovery-candidates">
          <div className="storage-recovery-candidate">
            <strong>{ar ? 'الأساسية' : 'Primary snapshot'}</strong>
            <span>{item.primary.status}{item.primary.revision ? ` · rev ${item.primary.revision}` : ''}</span>
            {item.primary.reason && <small>{item.primary.reason}</small>}
            {item.primaryData !== undefined && <button type="button" className="btn-secondary" onClick={() => inspect(item, 'primary')}>{ar ? 'معاينة واستخدامها' : 'Preview and use'}</button>}
            {item.primaryData !== undefined && <button type="button" className="btn-primary" disabled={busy !== null || preview?.collection !== item.collection || preview.source !== 'primary'} onClick={() => void resolve(item, 'primary')}>{ar ? 'اعتماد الأساسية الموثقة' : 'Use verified primary'}</button>}
          </div>
          <div className="storage-recovery-candidate">
            <strong>{ar ? 'النسخة السابقة' : 'Previous verified snapshot'}</strong>
            <span>{item.previous.status}{item.previous.revision ? ` · rev ${item.previous.revision}` : ''}</span>
            {item.previous.reason && <small>{item.previous.reason}</small>}
            {item.previousData !== undefined && <>
              <small>{candidateCount(item.previousData)}</small>
              <button type="button" className="btn-secondary" onClick={() => inspect(item, 'previous')}>{ar ? 'معاينة' : 'Preview'}</button>
              <button type="button" className="btn-primary" disabled={busy !== null || preview?.collection !== item.collection || preview.source !== 'previous'} onClick={() => void resolve(item, 'previous')}>{ar ? 'استعادة هذه النسخة' : 'Restore this snapshot'}</button>
            </>}
          </div>
          <div className="storage-recovery-candidate">
            <strong>{ar ? 'النسخة القديمة' : 'Legacy copy'}</strong>
            <span>{item.legacy.status}</span>
            {item.legacy.reason && <small>{item.legacy.reason}</small>}
            {item.legacyData !== undefined && <>
              <small>{candidateCount(item.legacyData)}</small>
              <button type="button" className="btn-secondary" onClick={() => inspect(item, 'legacy')}>{ar ? 'معاينة' : 'Preview'}</button>
              <button type="button" className="btn-primary" disabled={busy !== null || preview?.collection !== item.collection || preview.source !== 'legacy'} onClick={() => void resolve(item, 'legacy')}>{ar ? 'ترحيل هذه النسخة' : 'Migrate this copy'}</button>
            </>}
          </div>
        </div>

        <div className="storage-recovery-footer">
          <button type="button" className="btn-danger" disabled={busy !== null || !item.canUseEmpty} onClick={() => void resolve(item, 'empty')}>
            {ar ? 'بدء هذا السجل فارغاً' : 'Start this register empty'}
          </button>
          {busy === item.collection && <span className="muted-text">{ar ? 'جارٍ تنفيذ الاسترداد…' : 'Applying recovery choice…'}</span>}
        </div>

        {preview?.collection === item.collection && <div className="storage-recovery-preview">
          <div className="storage-recovery-preview-head">
            <strong>{ar ? 'معاينة النسخة المختارة' : 'Selected candidate preview'} · {preview.source}</strong>
            <button type="button" className="btn-secondary" onClick={() => setPreview(null)}>{ar ? 'إغلاق المعاينة' : 'Close preview'}</button>
          </div>
          <pre>{pretty(previewValue(item, preview.source))}</pre>
        </div>}
      </article>)}
    </section>

    <div className="notice-inline">
      <span>ⓘ</span>
      {ar
        ? 'التصدير لا يرسل بياناتك إلى أي خادم. النسخ الخام قد تحتوي بيانات تشغيلية حساسة؛ احفظها في مكان محمي. بصمة SHA-256 تكشف التلف العرضي، لكنها ليست حماية من مستخدم يتحكم بالجهاز.'
        : 'Export is local-only. Raw copies may contain sensitive operational data; store the export securely. SHA-256 checksums detect accidental corruption but do not protect against a person controlling this device.'}
    </div>
  </main>;
}
