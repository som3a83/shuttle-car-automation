import React, { useEffect, useState } from 'react';
import { backup } from '../storage';
import {
  assessMigrationRollback,
  rollbackToLegacyStorage,
  sha256Canonical,
  type MigrationRollbackAssessment
} from '../storage/migration';
import './StorageMigrationRollbackPanel.css';

interface StorageMigrationRollbackPanelProps {
  language: 'ar' | 'en';
  canRollback: boolean;
  beforeRollback?: () => Promise<void>;
  onRollbackComplete?: () => void;
}

function downloadSafetyBackup(value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `shuttle-before-rollback-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function StorageMigrationRollbackPanel({
  language,
  canRollback,
  beforeRollback,
  onRollbackComplete
}: StorageMigrationRollbackPanelProps) {
  const [assessment, setAssessment] = useState<MigrationRollbackAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupReady, setBackupReady] = useState(false);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [rollbackBusy, setRollbackBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');

  const ar = language === 'ar';

  async function refreshAssessment(): Promise<MigrationRollbackAssessment | null> {
    try {
      const result = await assessMigrationRollback();
      setAssessment(result);
      setError('');
      return result;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Rollback preflight could not be completed.');
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void assessMigrationRollback().then((result) => {
      if (active) setAssessment(result);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Rollback preflight could not be completed.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  if (!canRollback) return null;

  async function createSafetyBackup(): Promise<void> {
    setError('');
    setBackupReady(false);
    setBackupConfirmed(false);
    setBackupBusy(true);
    try {
      await beforeRollback?.();
      const value = await backup();
      const sha256 = await sha256Canonical(value);
      downloadSafetyBackup({
        format: 'shuttle-pre-rollback-safety-backup',
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        warning: 'Contains local operational data and account metadata. Unencrypted; store securely.',
        sha256,
        data: value
      });
      setBackupReady(true);
      const latest = await refreshAssessment();
      if (!latest?.eligible) {
        setBackupConfirmed(false);
        setError(latest?.reason || (ar ? 'تعذر التحقق من أهلية الرجوع.' : 'Rollback eligibility could not be verified.'));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'A complete safety backup could not be created.');
    } finally {
      setBackupBusy(false);
    }
  }

  async function rollback(): Promise<void> {
    if (!assessment?.eligible || !backupReady || !backupConfirmed || rollbackBusy) return;
    const accepted = window.confirm(ar
      ? 'سيعود التطبيق إلى بيانات localStorage التي تم حفظها وقت الترحيل. لن يتم حذف بيانات IndexedDB، لكنها ستظل خارج الاستخدام. هل تؤكد؟'
      : 'The app will return to the preserved localStorage data from migration time. IndexedDB records will be retained but deactivated. Continue?');
    if (!accepted) return;

    setError('');
    setRollbackBusy(true);
    try {
      await beforeRollback?.();
      const latest = await assessMigrationRollback();
      if (!latest.eligible) {
        setAssessment(latest);
        throw new Error(latest.reason || 'Rollback is no longer safe.');
      }
      await rollbackToLegacyStorage();
      setCompleted(true);
      onRollbackComplete?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Storage rollback failed. The current backend remains selected unless the transaction completed.');
      await refreshAssessment();
    } finally {
      setRollbackBusy(false);
    }
  }

  return (
    <section className="surface-card storage-rollback-panel" aria-labelledby="storage-rollback-title">
      <div className="storage-rollback-heading">
        <div>
          <span className="eyebrow">{ar ? 'استرداد التخزين / تحكم المسؤول' : 'STORAGE RECOVERY / ADMIN CONTROL'}</span>
          <h3 id="storage-rollback-title">{ar ? 'الرجوع الآمن إلى التخزين السابق' : 'Verified storage rollback'}</h3>
        </div>
        <span className={assessment?.eligible ? 'storage-rollback-status is-ready' : 'storage-rollback-status'}>
          {loading ? (ar ? 'جارٍ الفحص' : 'CHECKING') : assessment?.eligible ? (ar ? 'مؤهل للرجوع' : 'ELIGIBLE') : (ar ? 'الرجوع محظور' : 'BLOCKED')}
        </span>
      </div>

      <p className="muted-text">
        {ar
          ? 'يعيد تشغيل التطبيق على نسخة localStorage الأصلية التي لم تُحذف أثناء الترحيل. لا يُسمح بالرجوع إذا ظهرت تغييرات أحدث في IndexedDB أو إذا لم تتطابق بصمة المصدر القديم.'
          : 'Switches the next application startup to the preserved original localStorage source. Rollback is blocked if IndexedDB has newer writes or the legacy source fingerprint no longer matches.'}
      </p>

      <div className="storage-rollback-preflight" role="status" aria-live="polite">
        {loading
          ? (ar ? 'يتم فحص سجل الترحيل وبصمة البيانات وإصدارات السجلات…' : 'Checking migration history, source fingerprint and record revisions…')
          : assessment?.eligible
            ? (ar ? 'اجتاز فحص ما قبل التنفيذ: مصدر localStorage مطابق، ولم تتغير سجلات IndexedDB منذ الترحيل.' : 'Preflight passed: the legacy source matches the migration fingerprint and IndexedDB records have not changed since migration.')
            : (assessment?.reason || (ar ? 'لا توجد عملية ترحيل قابلة للرجوع.' : 'No eligible migration rollback is available.'))}
      </div>

      {assessment?.snapshot && (
        <div className="storage-rollback-meta">
          <span><strong>{ar ? 'معرّف الترحيل' : 'Migration ID'}</strong>{assessment.snapshot.migrationId}</span>
          <span><strong>{ar ? 'الأجيال المستهدف' : 'Active generation'}</strong>{assessment.activeGeneration}</span>
          <span><strong>{ar ? 'عدد المفاتيح' : 'Verified keys'}</strong>{assessment.snapshot.keyCount}</span>
          <span><strong>{ar ? 'بصمة المصدر' : 'Source SHA-256'}</strong>{assessment.snapshot.sourceFingerprint.slice(0, 20)}…</span>
        </div>
      )}

      <div className="storage-rollback-warning" role="note">
        {ar
          ? 'تنبيه: بيانات localStorage لم يتم تحديثها بعد الترحيل. إذا تغيّرت سجلات IndexedDB، سيرفض النظام الرجوع تلقائيًا حتى لا تضيع التعديلات الجديدة. ملف الأمان غير مشفر وقد يحتوي بيانات حسابات وتشغيل.'
          : 'Important: localStorage is the preserved pre-migration copy and may be stale. If IndexedDB changed, the system refuses rollback rather than discard newer records. The downloaded safety backup is unencrypted and may contain account and operational data.'}
      </div>

      {error && <div className="security-error" role="alert">{error}</div>}

      {!completed ? (
        <>
          <div className="storage-rollback-actions">
            <button
              type="button"
              className="btn-secondary"
              disabled={!assessment?.eligible || loading || backupBusy || rollbackBusy}
              onClick={() => void createSafetyBackup()}
            >
              {backupBusy
                ? (ar ? 'جارٍ إنشاء نسخة الأمان…' : 'Creating safety backup…')
                : (ar ? 'تنزيل نسخة أمان من IndexedDB' : 'Download IndexedDB safety backup')}
            </button>
            {backupReady && (
              <label className="storage-rollback-confirm">
                <input
                  type="checkbox"
                  checked={backupConfirmed}
                  disabled={rollbackBusy || !assessment?.eligible}
                  onChange={(event) => setBackupConfirmed(event.target.checked)}
                />
                <span>{ar ? 'حفظت نسخة الأمان خارج التطبيق في مكان آمن.' : 'I saved the safety backup outside the application in a secure location.'}</span>
              </label>
            )}
            <button
              type="button"
              className="btn-danger"
              disabled={!assessment?.eligible || !backupReady || !backupConfirmed || rollbackBusy || loading}
              onClick={() => void rollback()}
            >
              {rollbackBusy
                ? (ar ? 'جارٍ تنفيذ الرجوع الذري…' : 'Applying atomic rollback…')
                : (ar ? 'تأكيد الرجوع إلى التخزين السابق' : 'Confirm rollback to legacy storage')}
            </button>
          </div>
        </>
      ) : (
        <div className="storage-rollback-success" role="status">
          <strong>{ar ? 'تم اعتماد الرجوع بنجاح.' : 'Rollback committed successfully.'}</strong>
          <p>{ar ? 'تم الاحتفاظ بأجيال IndexedDB وتعطيل الكتابة إلى المحرك القديم في علامات التبويب المفتوحة. أعد تحميل التطبيق لاستخدام بيانات localStorage الأصلية.' : 'IndexedDB generations were retained and writes from stale open tabs are blocked. Reload the application to use the preserved localStorage data.'}</p>
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            {ar ? 'إعادة تحميل التطبيق الآن' : 'Reload application now'}
          </button>
        </div>
      )}
    </section>
  );
}
