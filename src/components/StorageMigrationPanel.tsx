import React, { useEffect, useState } from 'react';
import { getMode, getStorageModePreference, type StorageMode, type StorageModePreference } from '../storage';
import type { Language } from '../types';

type MigrationResult = { success: boolean; state: string; completedKeyCount: number; expectedKeyCount: number; error?: string };

export default function StorageMigrationPanel({ language, canMigrate }: { language: Language; canMigrate: boolean }) {
  const ar = language === 'ar';
  const [mode, setMode] = useState<StorageMode | null>(null);
  const [preference, setPreference] = useState<StorageModePreference>('legacy');
  const [busy, setBusy] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<MigrationResult | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([getMode(), Promise.resolve(getStorageModePreference())])
      .then(([nextMode, nextPreference]) => {
        if (!active) return;
        setMode(nextMode);
        setPreference(nextPreference);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Storage inspection failed.');
      });
    return () => { active = false; };
  }, []);

  const startMigration = async () => {
    if (!canMigrate || busy || mode !== 'legacy-fallback' || preference === 'indexeddb') return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const { migrateToIndexedDb } = await import('../storage/migration');
      const next = await migrateToIndexedDb();
      setResult(next);
      if (next.success) setNeedsReload(true);
      else setError(next.error || (ar ? 'تعذر إكمال ترحيل البيانات.' : 'The data migration did not complete.'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (ar ? 'فشل فحص وترحيل التخزين.' : 'Storage migration failed.'));
    } finally {
      setBusy(false);
    }
  };

  const modeLabel = mode === 'indexeddb'
    ? (ar ? 'قاعدة IndexedDB نشطة' : 'IndexedDB active')
    : mode === 'legacy-fallback'
      ? (ar ? 'تخزين محلي متوافق (localStorage)' : 'Legacy localStorage backend')
      : mode === 'readonly-recovery'
        ? (ar ? 'وضع الاسترداد للقراءة فقط' : 'Read-only recovery mode')
        : (ar ? 'جارٍ فحص التخزين…' : 'Inspecting storage…');

  return (
    <section className="surface-card storage-migration-panel" aria-labelledby="storage-migration-title">
      <div className="card-head">
        <div>
          <span className="eyebrow">DATA LIFECYCLE / VERIFIED BACKEND</span>
          <h3 id="storage-migration-title">{ar ? 'محرك التخزين وترحيل البيانات' : 'Storage engine & data migration'}</h3>
        </div>
        <span className={mode === 'indexeddb' ? 'status-pill status-ready' : 'status-pill status-unknown'}>{modeLabel}</span>
      </div>
      <p className="muted-text">
        {ar
          ? 'يتم نقل السجلات الـ17 إلى جيل IndexedDB معزول، والتحقق منها قبل تبديل المؤشر النشط. النسخة المحلية القديمة لا تُحذف. يلزم مسؤول النظام الأعلى لإجراء الترحيل.'
          : 'The 17 approved records are copied into an isolated IndexedDB generation and verified before the active pointer is switched. Original localStorage values are retained. A Super Admin must start the migration.'}
      </p>
      {!canMigrate && mode !== 'indexeddb' && <p className="notice-inline" role="note">{ar ? 'يتطلب الترحيل تسجيل دخول المسؤول الأعلى.' : 'Sign in as the Super Admin to start migration.'}</p>}
      {needsReload ? (
        <div className="notice-inline" role="status">
          <strong>{ar ? 'اكتمل الترحيل والتحقق من السجلات.' : 'Migration and record verification completed.'}</strong>
          <span>{ar ? 'أعد تشغيل التطبيق لتفعيل محرك IndexedDB في جميع الوحدات.' : 'Restart the application to activate IndexedDB across all modules.'}</span>
          <button className="btn-primary" type="button" onClick={() => window.location.reload()}>{ar ? 'إعادة تشغيل التطبيق الآن' : 'Reload and activate IndexedDB'}</button>
        </div>
      ) : mode === 'indexeddb' ? (
        <p className="notice-inline" role="status">{ar ? 'IndexedDB هو محرك التخزين النشط. فحص الإقلاع يتحقق من وجود مجموعات التشغيل الـ12 قبل تحميل التطبيق.' : 'IndexedDB is active. Startup validation checks all 12 operational collections before mounting the application.'}</p>
      ) : (
        <button className="btn-primary" type="button" onClick={() => void startMigration()} disabled={!canMigrate || busy || mode !== 'legacy-fallback' || preference === 'indexeddb'}>
          {busy ? (ar ? 'جارٍ نسخ البيانات والتحقق منها…' : 'Copying and verifying records…') : (ar ? 'فحص وترحيل 17 سجلًا إلى IndexedDB' : 'Verify and migrate 17 records to IndexedDB')}
        </button>
      )}
      {result && <p className="muted-text" role="status">{ar ? 'النتيجة: ' : 'Result: '}{result.state} · {result.completedKeyCount}/{result.expectedKeyCount} {ar ? 'سجلًا' : 'records'}</p>}
      {error && <div className="security-error" role="alert">{error}</div>}
      <p className="muted-text">{ar ? 'هذا الترحيل محلي على الجهاز ولا ينشئ مزامنة سحابية.' : 'This is a local-device migration. It does not create cloud synchronization.'}</p>
    </section>
  );
}
