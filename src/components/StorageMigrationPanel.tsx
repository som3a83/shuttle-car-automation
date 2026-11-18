import React, { useEffect, useState } from 'react';
import { getMode, type StorageMode } from '../storage';
import { migrateToIndexedDb } from '../storage/migration';
import { createLegacyStorageBackup, type LegacyStorageBackup } from '../storage/migration/legacyBackup';

interface StorageMigrationPanelProps {
  language: 'ar' | 'en';
  canMigrate: boolean;
  beforeBackup?: () => Promise<void>;
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
  canMigrate,
  beforeBackup,
  onLockChange,
  onMigrationComplete
}: StorageMigrationPanelProps) {
  const [mode, setMode] = useState<StorageMode | null>(null);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [backup, setBackup] = useState<LegacyStorageBackup | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [phase, setPhase] = useState<'preflight' | 'backup' | 'ready' | 'migrating' | 'complete' | 'failed'>('preflight');
  const [error, setError] = useState('');

  const ar = language === 'ar';

  useEffect(() => {
    let active = true;
    void getMode().then((result) => {
      if (active) {
        setMode(result);
        setPhase(result === 'legacy-fallback' ? 'preflight' : 'ready');
      }
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Storage inspection failed.');
    });
    return () => { active = false; };
  }, []);

  function downloadBackupFile(created: LegacyStorageBackup): void {
    const filename = `shuttle-pre-migration-backup-${created.exportedAt.replace(/[:.]/g, '-')}.json`;
    const blob = new Blob([JSON.stringify(created, null, 2)], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  async function createBackup(): Promise<void> {
    if (!canMigrate || backupBusy || busy || mode !== 'legacy-fallback') return;
    setError('');
    setBackupConfirmed(false);
    setPhase('backup');
    setBackupBusy(true);
    try {
      await beforeBackup?.();
      const created = await createLegacyStorageBackup(window.localStorage);
      downloadBackupFile(created);
      setBackup(created);
      setPhase('ready');
    } catch (reason) {
      setPhase('failed');
      setError(reason instanceof Error ? reason.message : 'A complete verified backup could not be created.');
    } finally {
      setBackupBusy(false);
    }
  }

  async function runMigration(): Promise<void> {
    if (!canMigrate || !backup || !backupConfirmed || busy || mode !== 'legacy-fallback') return;
    setError('');
    setPhase('preflight');
    setBusy(true);
    onLockChange?.(true);
    try {
      // Freeze the application, flush every queued write, then compare the exact
      // persisted source with the backup the operator already confirmed.
      await beforeBackup?.();
      const latest = await createLegacyStorageBackup(window.localStorage);
      if (JSON.stringify(latest.records) !== JSON.stringify(backup.records)) {
        downloadBackupFile(latest);
        setBackup(latest);
        setBackupConfirmed(false);
        setPhase('backup');
        setError(ar
          ? 'تغيّرت البيانات بعد النسخة السابقة. تم تنزيل نسخة أحدث؛ احفظها وأكّدها قبل الترحيل.'
          : 'Application data changed after the previous backup. A fresh backup was downloaded; save and confirm it before migrating.');
        setBusy(false);
        onLockChange?.(false);
        return;
      }

      setPhase('migrating');
      const result = await migrateToIndexedDb({ expectedSourceFingerprint: backup.migrationSourceFingerprint });
      if (!result.success || result.state !== 'COMPLETE') {
        throw new Error(result.error || `Storage migration stopped in state ${result.state}.`);
      }
      setComplete(true);
      setPhase('complete');
      setBusy(false);
      onMigrationComplete?.();
      // Keep the application locked until a reload selects the newly activated backend.
    } catch (reason) {
      setPhase('failed');
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
      <div className="storage-migration-lifecycle" role="status" aria-live="polite">
        <div className={phase === 'preflight' || phase === 'backup' || phase === 'ready' || phase === 'migrating' || phase === 'complete' ? 'is-done' : ''}>
          <strong>{ar ? '1. فحص ما قبل الترحيل' : '1. Pre-flight'}</strong>
          <small>{ar ? 'قراءة المصدر والتحقق من مفاتيح التخزين' : 'Inspect the legacy source and approved key list'}</small>
        </div>
        <div className={phase === 'ready' || phase === 'migrating' || phase === 'complete' ? 'is-done' : ''}>
          <strong>{ar ? '2. النسخ والبدء' : '2. Backup & start'}</strong>
          <small>{ar ? 'نسخة أمان مؤكدة ثم بدء يدوي' : 'Confirmed safety backup, then explicit start'}</small>
        </div>
        <div className={phase === 'complete' ? 'is-done' : phase === 'migrating' ? 'is-active' : ''}>
          <strong>{ar ? '3. التحقق والاعتماد' : '3. Verify & commit'}</strong>
          <small>{ar ? 'مراجعة السجلات قبل تفعيل IndexedDB' : 'Verify records before activating IndexedDB'}</small>
        </div>
      </div>
      {busy && <div className="storage-migration-progress" role="status" aria-live="polite">
        <span className="storage-migration-progress-spinner" aria-hidden="true"/>
        <div><strong>{ar ? 'الترحيل قيد التنفيذ' : 'Migration in progress'}</strong><p>{ar ? 'يتم نسخ السجلات والتحقق منها. لا تغلق التطبيق أو تغيّر بياناته.' : 'Records are being staged and verified. Do not close the app or modify data.'}</p></div>
      </div>}
      {!canMigrate && mode !== 'indexeddb' && (
        <div className="notice-inline" role="note">
          {ar ? 'يتطلب إنشاء النسخة الاحتياطية والترحيل تسجيل دخول المسؤول الأعلى.' : 'Sign in as the Super Admin to create a migration backup and start migration.'}
        </div>
      )}
      {mode === 'readonly-recovery' && (
        <div className="security-error" role="alert">
          {ar ? 'التخزين في وضع استعادة للقراءة فقط. أكمل الاستعادة قبل بدء الترحيل.' : 'Storage is in read-only recovery mode. Complete recovery before migrating.'}
        </div>
      )}
      {!complete && mode !== 'indexeddb' && (
        <div className="storage-migration-backup-warning" role="note">
          {ar
            ? 'تنبيه خصوصية: ملف النسخة يحتوي على بيانات localStorage كاملة، ومنها بيانات الحسابات وسجلات التدقيق والتشغيل. الملف غير مشفر؛ احتفظ به في مكان آمن ولا ترسله لأي طرف.'
            : 'Privacy warning: this file contains the full localStorage snapshot, including local account hashes, audit entries and operational records. It is not encrypted. Store it securely and do not share it.'}
        </div>
      )}
      {mode === 'indexeddb' && !complete && (
        <div className="notice-inline" role="status">
          {ar ? 'قاعدة بيانات IndexedDB مفعّلة بالفعل على هذا الجهاز.' : 'IndexedDB is already active on this device.'}
        </div>
      )}
      {!complete && mode !== 'indexeddb' && (
        <div className="storage-migration-backup">
          <button
            type="button"
            className="btn-secondary"
            disabled={!canMigrate || busy || backupBusy || !mode || mode !== 'legacy-fallback'}
            onClick={() => void createBackup()}
          >
            {backupBusy
              ? (ar ? 'جارٍ إعداد النسخة الاحتياطية…' : 'Preparing complete backup…')
              : (ar ? 'إنشاء نسخة احتياطية كاملة من بيانات الجهاز' : 'Create complete local data backup')}
          </button>
          {backup && (
            <>
              <div className="storage-migration-backup-details" role="status">
                <strong>{ar ? 'تم إنشاء ملف النسخة الاحتياطية' : 'Backup file created'}</strong>
                <span>{backup.recordCount} {ar ? 'مفتاح تخزين' : 'localStorage keys'} · SHA-256: {backup.sha256.slice(0, 16)}…</span>
              </div>
              <label className="storage-migration-confirm">
                <input
                  type="checkbox"
                  checked={backupConfirmed}
                  disabled={busy || backupBusy}
                  onChange={(event) => setBackupConfirmed(event.target.checked)}
                />
                <span>
                  {ar
                    ? 'حفظت ملف النسخة الاحتياطية في مكان آمن خارج بيانات التطبيق.'
                    : 'I saved the downloaded backup file to a secure location outside the app.'}
                </span>
              </label>
            </>
          )}
        </div>
      )}
      <div className="storage-migration-retention" role="note">
        <strong>{ar ? 'سياسة الاحتفاظ' : 'Retention policy'}</strong>
        <p>{ar
          ? 'لا يحذف التطبيق مفاتيح localStorage تلقائيًا، ولا يحذف أجيال IndexedDB السابقة. لا يجوز لأي تنظيف مستقبلي حذف جيل قبل مرور 90 يومًا وخمس مرات تشغيل ناجحة على الأقل.'
          : 'The app never automatically deletes legacy localStorage keys or previous IndexedDB generations. Any future cleanup must wait at least 90 days and five successful application launches.'}</p>
      </div>
      {phase === 'failed' && !complete && <div className="storage-migration-recovery" role="note">
        <strong>{ar ? 'الاسترداد بعد التعثر' : 'Failure recovery'}</strong>
        <p>{ar
          ? 'بقي التخزين القديم محددًا ولم تُحذف مفاتيح المصدر. راجع سبب الخطأ، احتفظ بالنسخة الاحتياطية، ثم أنشئ نسخة جديدة وأعد المحاولة يدويًا.'
          : 'The legacy backend remains selected and no source keys were deleted. Review the error, keep the safety backup, create a fresh verified backup and retry manually.'}</p>
      </div>}
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
          disabled={!canMigrate || !backup || !backupConfirmed || busy || backupBusy || mode !== 'legacy-fallback'}
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
