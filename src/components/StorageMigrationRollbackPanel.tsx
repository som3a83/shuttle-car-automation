import React, { useEffect, useState } from 'react';
import { backup } from '../storage';
import {
  assessMigrationRollback,
  rollbackToLegacyStorage,
  sha256Canonical,
  type MigrationRollbackAssessment,
  type RollbackProgress
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

function progressLabel(progress: RollbackProgress, ar: boolean): string {
  const stageLabels: Record<RollbackProgress['stage'], string> = ar
    ? {
        preflight: 'فحص ما قبل التنفيذ',
        staging: 'تجهيز نسخة مرحلية',
        'verifying-staging': 'التحقق من النسخة المرحلية',
        'writing-legacy': 'كتابة البيانات إلى التخزين السابق',
        'verifying-legacy': 'التحقق من مفاتيح التخزين السابقة',
        'switching-mode': 'اعتماد محرك التخزين',
        complete: 'اكتمل الرجوع'
      }
    : {
        preflight: 'Pre-flight checks',
        staging: 'Staging current values',
        'verifying-staging': 'Verifying staged data',
        'writing-legacy': 'Writing legacy storage',
        'verifying-legacy': 'Verifying legacy keys',
        'switching-mode': 'Switching storage mode',
        complete: 'Rollback complete'
      };
  return stageLabels[progress.stage] + ' — ' + progress.completedKeys + '/' + progress.totalKeys;
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
  const [progress, setProgress] = useState<RollbackProgress | null>(null);
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
        warning: 'Contains current local operational data and account metadata. Unencrypted; store securely.',
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
      ? 'سيتم نسخ أحدث بيانات IndexedDB إلى مفاتيح localStorage المعتمدة، والتحقق من المفاتيح السبعة عشر، ثم تحويل التشغيل إلى التخزين السابق. لن تُحذف مفاتيح التخزين القديمة أو أجيال IndexedDB. هل تؤكد؟'
      : 'The latest IndexedDB data will be copied to all 17 approved localStorage keys and verified before switching the next startup to legacy storage. No legacy keys or IndexedDB generations will be deleted. Continue?');
    if (!accepted) return;

    setError('');
    setProgress(null);
    setRollbackBusy(true);
    try {
      await beforeRollback?.();
      const latest = await assessMigrationRollback();
      setAssessment(latest);
      if (!latest.eligible) throw new Error(latest.reason || 'Reverse migration is no longer eligible.');

      await rollbackToLegacyStorage(window.localStorage, setProgress);
      setCompleted(true);
      onRollbackComplete?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Reverse migration failed. IndexedDB remains selected unless the final mode-switch transaction completed.');
      await refreshAssessment();
    } finally {
      setRollbackBusy(false);
    }
  }

  const progressPercent = progress && progress.totalKeys > 0
    ? Math.min(100, Math.round((progress.completedKeys / progress.totalKeys) * 100))
    : 0;

  return (
    <section className="surface-card storage-rollback-panel" aria-labelledby="storage-rollback-title">
      <div className="storage-rollback-heading">
        <div>
          <span className="eyebrow">{ar ? 'استرداد التخزين / تحكم المسؤول' : 'STORAGE RECOVERY / ADMIN CONTROL'}</span>
          <h3 id="storage-rollback-title">{ar ? 'الرجوع العكسي الموثّق' : 'Verified reverse migration'}</h3>
        </div>
        <span className={assessment?.eligible ? 'storage-rollback-status is-ready' : 'storage-rollback-status'}>
          {loading ? (ar ? 'جارٍ الفحص' : 'CHECKING') : assessment?.eligible ? (ar ? 'جاهز للتنفيذ' : 'READY') : (ar ? 'التنفيذ محظور' : 'BLOCKED')}
        </span>
      </div>

      <p className="muted-text">
        {ar
          ? 'يقرأ أحدث القيم من IndexedDB، ويجهزها في مفاتيح مرحلية، ويتحقق من JSON، ثم يكتبها إلى مفاتيح localStorage السبعة عشر ويعيد التحقق منها. لا يتغير محرك التشغيل إلا بعد نجاح جميع عمليات الكتابة والتحقق.'
          : 'Reads the latest IndexedDB values, stages and verifies their JSON, writes them to all 17 approved localStorage keys, and verifies them again. The active backend preference changes only after every write and verification succeeds.'}
      </p>

      <div className="storage-rollback-preflight" role="status" aria-live="polite">
        {loading
          ? (ar ? 'يتم فحص سجل الترحيل، ومحرك التخزين، وصلاحية مفاتيح المصدر…' : 'Checking migration history, storage mode and approved legacy keys…')
          : assessment?.eligible
            ? (ar
                ? `اجتاز فحص ما قبل التنفيذ: ${assessment.keyCount} مفتاحًا معتمدًا جاهزًا للنسخ، وسيتم استخدام ${assessment.defaultedKeyCount} قيمة افتراضية للمفاتيح الغائبة.`
                : `Preflight passed: ${assessment.keyCount} approved keys are ready; ${assessment.defaultedKeyCount} missing IndexedDB keys will use their approved defaults.`)
            : (assessment?.reason || (ar ? 'لا توجد عملية ترحيل قابلة للعكس.' : 'No eligible reverse migration is available.'))}
      </div>

      {assessment?.snapshot && (
        <div className="storage-rollback-meta">
          <span><strong>{ar ? 'معرّف الترحيل' : 'Migration ID'}</strong>{assessment.snapshot.migrationId}</span>
          <span><strong>{ar ? 'الجيل النشط' : 'Active generation'}</strong>{assessment.activeGeneration}</span>
          <span><strong>{ar ? 'مفاتيح الرجوع' : 'Reverse keys'}</strong>{assessment.keyCount} / 17</span>
          <span><strong>{ar ? 'قيم افتراضية' : 'Approved defaults'}</strong>{assessment.defaultedKeyCount}</span>
        </div>
      )}

      <div className="storage-rollback-warning" role="note">
        {ar
          ? 'النسخ المرحلي والكتابة لا يحذفان أي مفتاح قديم أو سجل من IndexedDB. عند انقطاع العملية قبل اعتماد المحرك، يبقى IndexedDB هو المصدر النشط ويمكن إعادة المحاولة. ملف نسخة الأمان غير مشفر وقد يحتوي بيانات الحسابات والتشغيل.'
          : 'Staging and reverse writes never delete legacy keys or IndexedDB records. If interrupted before the final mode switch, IndexedDB remains the selected backend and the operation can be retried. The safety backup is unencrypted and may contain account and operational data.'}
      </div>

      <div className="storage-rollback-retention" role="note">
        <strong>{ar ? 'سياسة الاحتفاظ بالأجيال السابقة' : 'Previous-generation retention'}</strong>
        <p>{ar
          ? 'لا يوجد حذف تلقائي للأجيال أو النسخ المرحلية. ستظل الأجيال السابقة محفوظة؛ وأي سياسة تنظيف مستقبلية يجب ألا تسمح بالحذف قبل مرور 90 يومًا وخمس مرات تشغيل ناجحة على الأقل.'
          : 'No automatic generation or staging cleanup is performed. Previous generations remain retained. Any future cleanup policy must require both at least 90 days and five successful application launches before deletion.'}</p>
      </div>

      {error && <div className="security-error" role="alert">{error}</div>}

      {progress && rollbackBusy && (
        <div className="storage-rollback-progress" role="status" aria-live="polite">
          <div className="storage-rollback-progress-head">
            <strong>{progressLabel(progress, ar)}</strong>
            <span>{progressPercent}%</span>
          </div>
          <div className="storage-rollback-progress-track">
            <span style={{ width: progressPercent + '%' }}/>
          </div>
          <p>{progress.message}</p>
        </div>
      )}

      {!completed ? (
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
              ? (ar ? 'جارٍ نسخ البيانات والتحقق منها…' : 'Copying and verifying current data…')
              : (ar ? 'بدء الرجوع العكسي إلى التخزين السابق' : 'Start verified reverse migration')}
          </button>
        </div>
      ) : (
        <div className="storage-rollback-success" role="status">
          <strong>{ar ? 'تم نسخ البيانات والتحقق منها واعتماد الرجوع.' : 'Reverse migration verified and committed.'}</strong>
          <p>{ar ? 'تم التحقق من مفاتيح التخزين السبعة عشر. لم تُحذف مفاتيح localStorage أو أجيال IndexedDB. أعد تحميل التطبيق لاستخدام التخزين السابق.' : 'All 17 legacy keys were verified. No localStorage keys or IndexedDB generations were deleted. Reload the application to use legacy storage.'}</p>
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            {ar ? 'إعادة تحميل التطبيق الآن' : 'Reload application now'}
          </button>
        </div>
      )}
    </section>
  );
}
