import React, { useEffect, useState } from 'react';
import { getMode, type StorageMode } from '../storage';
import { migrateToIndexedDb } from '../storage/migration';

interface StorageMigrationPanelProps {
  language: 'ar' | 'en';
  onLockChange?: (locked: boolean) => void;
  onMigrationComplete?: () => void;
}

function modeLabel(mode: StorageMode | null, language: 'ar' | 'en'): string {
  if (!mode) return language === 'ar' ? 'جارٍ فحص محرك التخزين…' : 'Checking storage engine…';
  if (mode === 'indexeddb') return 'IndexedDB';
  if (mode === 'legacy-fallback') return language === 'ar' ? 'التخزين المحلي القديم' : 'Legacy local storage';
  return language === 'ar' ? 'وضع استعادة للقراءة فقط' : 'Read-only recovery mode';
}

export default function StorageMigrationPanel({
  language,
  onLockChange,
  onMigrationComplete
}: StorageMigrationPanelProps) {
  const [mode, setMode] = useState<StorageMode | null>(null);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');

  const ar = language === 'ar';

  useEffect(() => {
    let active = true;
    void getMode().then((result) => {
      if (active) setMode(result);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Storage inspection failed.');
    });
    return () => { active = false; };
  }, []);

  async function runMigration(): Promise<void> {
    if (!backupConfirmed || busy || mode === 'indexeddb' || mode === 'readonly-recovery') return;
    setError('');
    setBusy(true);
    onLockChange?.(true);
    try {
      const result = await migrateToIndexedDb();
      if (!result.success || result.state !== 'COMPLETE') {
        throw new Error(result.error || `Storage migration stopped in state ${result.state}.`);
      }
      setComplete(true);
      setBusy(false);
      onMigrationComplete?.();
      // Keep the application locked until a reload selects the newly activated backend.
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Storage migration failed. The legacy source remains available.');
      setBusy(false);
      onLockChange?.(false);
    }
  }

  return (
    <section className="surface-card storage-migration-panel" aria-labelledby="storage-migration-title">
      <div className="card-head">
        <div>
          <span className="eyebrow">{ar ? 'سلامة البيانات / ترحيل التخزين' : 'DATA INTEGRITY / STORAGE MIGRATION'}</span>
          <h3 id="storage-migration-title">{ar ? 'تفعيل قاعدة بيانات IndexedDB' : 'Activate IndexedDB storage'}</h3>
        </div>
        <span className={mode === 'indexeddb' || complete ? 'storage-mode-pill storage-mode-ready' : 'storage-mode-pill'}>
          {modeLabel(mode, language)}
        </span>
      </div>
      <p className="muted-text">
        {ar
          ? 'ينقل هذا الإجراء سجلات التشغيل والحسابات وسجل التدقيق والتخصيص إلى محرك واحد. المصدر القديم لا يُحذف. يلزم إعادة تحميل التطبيق بعد نجاح الترحيل حتى تستخدم كل الوحدات قاعدة البيانات الجديدة.'
          : 'This operation migrates operational records, accounts, audit history and customization to one shared engine. The legacy source is preserved. Reload the app after success so every subsystem uses the new database.'}
      </p>
      {mode === 'readonly-recovery' && (
        <div className="security-error" role="alert">
          {ar ? 'التخزين في وضع استعادة للقراءة فقط. أكمل الاستعادة قبل بدء الترحيل.' : 'Storage is in read-only recovery mode. Complete recovery before migrating.'}
        </div>
      )}
      {mode === 'indexeddb' && !complete && (
        <div className="notice-inline" role="status">
          {ar ? 'قاعدة بيانات IndexedDB مفعّلة بالفعل على هذا الجهاز.' : 'IndexedDB is already active on this device.'}
        </div>
      )}
      {!complete && mode !== 'indexeddb' && (
        <label className="storage-migration-confirm">
          <input
            type="checkbox"
            checked={backupConfirmed}
            disabled={busy || mode === 'readonly-recovery'}
            onChange={(event) => setBackupConfirmed(event.target.checked)}
          />
          <span>
            {ar
              ? 'أنشأت نسخة احتياطية من قسم «النسخ الاحتياطي واستعادة البيانات» أعلاه.'
              : 'I created a backup using the Backup and restore section above.'}
          </span>
        </label>
      )}
      {error && <div className="security-error" role="alert">{error}</div>}
      {complete ? (
        <div className="storage-migration-success" role="status">
          <strong>{ar ? 'اكتمل الترحيل والتحقق بنجاح.' : 'Migration and verification completed successfully.'}</strong>
          <p>{ar ? 'أعد تحميل التطبيق الآن لتفعيل محرك IndexedDB في جميع الوحدات.' : 'Reload the application now to activate IndexedDB across all modules.'}</p>
        </div>
      ) : (
        <button
          type="button"
          className="btn-primary"
          disabled={!backupConfirmed || busy || !mode || mode === 'indexeddb' || mode === 'readonly-recovery'}
          onClick={() => void runMigration()}
        >
          {busy
            ? (ar ? 'جارٍ نقل السجلات والتحقق منها…' : 'Migrating and verifying records…')
            : (ar ? 'ترحيل السجلات إلى IndexedDB' : 'Migrate records to IndexedDB')}
        </button>
      )}
    </section>
  );
}
