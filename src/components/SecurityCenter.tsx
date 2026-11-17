import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Language, Role, User } from '../types';
import { appendAuditRecord, archiveAuditRecords, auditRecordsToCsv, filterAuditRecords, readAllAuditRecords, readAuditArchives, verifyAuditLedger, type AuditRecord } from '../security/auditLog';
import {
  authenticateLocalAccount,
  createLocalAccount,
  endLocalSession,
  listLocalAccounts,
  localAccountRegistryError,
  type LocalAccountSummary
} from '../security/localAuth';

const roles: Role[] = ['Admin', 'Supervisor', 'Maintenance Engineer', 'Technician', 'Operator', 'Viewer'];

export default function SecurityCenter({
  language,
  currentUser,
  onSessionChange
}: {
  language: Language;
  currentUser: User;
  onSessionChange: (user: User | null) => void;
}) {
  const ar = language === 'ar';
  const [accounts, setAccounts] = useState<LocalAccountSummary[]>(() => listLocalAccounts(localStorage));
  const [registryError, setRegistryError] = useState<string | null>(() => localAccountRegistryError(localStorage));
  const [auditIntegrity, setAuditIntegrity] = useState<{
    valid: boolean;
    activeChecked: number;
    archivedChecked: number;
    archiveCount: number;
    brokenArchiveIndex: number | null;
    brokenRecordIndex: number | null;
    reason?: string;
  } | null>(null);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [auditQuery, setAuditQuery] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditEntityFilter, setAuditEntityFilter] = useState('');
  const [auditBusy, setAuditBusy] = useState(false);
  const [login, setLogin] = useState({ identity: '', password: '' });
  const [newAccount, setNewAccount] = useState({ name: '', email: '', username: '', role: 'Maintenance Engineer' as Role, password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isAuthenticated = currentUser.isAuthenticated;
  const isAdministrator = isAuthenticated && (currentUser.role === 'Super Admin' || currentUser.role === 'Admin');
  const canBootstrap = accounts.length === 0 && !registryError;
  const canManageAccounts = canBootstrap || (!registryError && isAuthenticated && currentUser.role === 'Super Admin');

  const refresh = async () => {
    setAccounts(listLocalAccounts(localStorage));
    setRegistryError(localAccountRegistryError(localStorage));
    try {
      const result = await verifyAuditLedger(localStorage);
      setAuditIntegrity(result);
      setAuditRecords(result.valid ? await readAllAuditRecords(localStorage) : []);
    } catch (reason) {
      setAuditIntegrity({
        valid: false, activeChecked: 0, archivedChecked: 0, archiveCount: 0,
        brokenArchiveIndex: null, brokenRecordIndex: null,
        reason: reason instanceof Error ? reason.message : 'Audit ledger could not be read.'
      });
      setAuditRecords([]);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const recentAudit = useMemo(() => filterAuditRecords(auditRecords, {
    query: auditQuery, action: auditActionFilter, entityType: auditEntityFilter
  }).slice(-100).reverse(), [auditRecords, auditQuery, auditActionFilter, auditEntityFilter]);

  const auditActions = useMemo(() => [...new Set(auditRecords.map(record => record.action))].sort(), [auditRecords]);
  const auditEntities = useMemo(() => [...new Set(auditRecords.map(record => record.entityType))].sort(), [auditRecords]);

  const downloadAuditFile = (fileName: string, content: string, mimeType: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportAuditJson = async () => {
    setAuditBusy(true);
    setError('');
    try {
      const integrity = await verifyAuditLedger(localStorage);
      if (!integrity.valid) throw new Error(integrity.reason || 'Audit ledger integrity verification failed.');
      const [records, archives] = await Promise.all([
        readAllAuditRecords(localStorage),
        Promise.resolve(readAuditArchives(localStorage))
      ]);
      downloadAuditFile(
        `shuttle-audit-ledger-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
        JSON.stringify({ format: 'shuttle-audit-ledger-export', exportedAt: new Date().toISOString(), integrity, archiveCount: archives.length, archives, records }, null, 2),
        'application/json'
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Audit JSON export failed.');
    } finally {
      setAuditBusy(false);
      await refresh();
    }
  };

  const exportAuditCsv = async () => {
    setAuditBusy(true);
    setError('');
    try {
      const integrity = await verifyAuditLedger(localStorage);
      if (!integrity.valid) throw new Error(integrity.reason || 'Audit ledger integrity verification failed.');
      const records = await readAllAuditRecords(localStorage);
      downloadAuditFile(`shuttle-audit-ledger-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`, auditRecordsToCsv(records), 'text/csv;charset=utf-8');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Audit CSV export failed.');
    } finally {
      setAuditBusy(false);
      await refresh();
    }
  };

  const archiveActiveAudit = async () => {
    if (!isAuthenticated || currentUser.role !== 'Super Admin') {
      setError(ar ? 'أرشفة سجل التدقيق متاحة للمسؤول الأعلى فقط.' : 'Only the Super Admin can archive the active audit ledger.');
      return;
    }
    const accepted = window.confirm(ar
      ? 'سيتم نقل جميع أحداث السجل النشط إلى أرشيف مترابط ببصمة SHA-256. لن تُحذف السجلات. هل تريد المتابعة؟'
      : 'Archive all active audit events into a SHA-256 chained archive? Records are retained, not deleted. Continue?');
    if (!accepted) return;
    setAuditBusy(true);
    setError('');
    try {
      const archive = await archiveAuditRecords(localStorage);
      downloadAuditFile(
        `shuttle-audit-archive-${archive.id}.json`,
        JSON.stringify({ format: 'shuttle-audit-archive-export', exportedAt: new Date().toISOString(), archive }, null, 2),
        'application/json'
      );
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Audit archive failed. Original records were retained when recovery was possible.');
      await refresh();
    } finally {
      setAuditBusy(false);
    }
  };

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await authenticateLocalAccount(login.identity, login.password);
      if (!result.ok) {
        const message = result.reason === 'locked'
          ? (ar ? 'تم إيقاف المحاولات مؤقتًا لمدة دقيقة.' : 'Sign-in is temporarily locked for one minute.')
          : (ar ? 'اسم المستخدم أو كلمة المرور غير صحيحة.' : 'The username/email or password is incorrect.');
        setError(message);
        return;
      }
      let auditWarning = '';
      try {
        await appendAuditRecord({
          actorId: result.account.id, actorRole: result.account.role, action: 'LOCAL_LOGIN',
          entityType: 'account', entityId: result.account.id, detail: 'Local device session started.'
        });
      } catch { auditWarning = ar ? 'تحذير: تعذر التحقق أو تحديث سجل التدقيق.' : 'Warning: the audit log could not be verified or updated.'; }
      onSessionChange({
        id: result.account.id, name: result.account.name, email: result.account.email,
        role: result.account.role, isAuthenticated: true
      });
      setLogin({ identity: '', password: '' });
      setError(auditWarning);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (ar ? 'تعذر تسجيل الدخول.' : 'Sign-in failed.'));
    } finally {
      setBusy(false);
    }
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (newAccount.password !== newAccount.confirm) {
      setError(ar ? 'تأكيد كلمة المرور غير مطابق.' : 'Password confirmation does not match.');
      return;
    }
    if (!canManageAccounts) {
      setError(ar ? 'إنشاء الحسابات متاح للمسؤول الأعلى فقط.' : 'Only an authenticated Super Admin can create additional local accounts.');
      return;
    }
    setBusy(true);
    try {
      const account = await createLocalAccount({
        name: newAccount.name, email: newAccount.email, username: newAccount.username,
        role: canBootstrap ? 'Super Admin' : newAccount.role, password: newAccount.password
      });
      let auditWarning = '';
      try { await appendAuditRecord({
        actorId: isAuthenticated ? currentUser.id : account.id,
        actorRole: isAuthenticated ? currentUser.role : 'Super Admin',
        action: canBootstrap ? 'LOCAL_ADMIN_BOOTSTRAPPED' : 'LOCAL_ACCOUNT_CREATED',
        entityType: 'account', entityId: account.id, detail: `Created local account ${account.username}.`
      }); } catch { auditWarning = ar ? 'تحذير: تم إنشاء الحساب لكن سجل التدقيق يحتاج مراجعة.' : 'Warning: the account was created, but the audit log needs review.'; }
      const signedIn = await authenticateLocalAccount(account.username, newAccount.password);
      if (signedIn.ok) {
        onSessionChange({
          id: signedIn.account.id, name: signedIn.account.name, email: signedIn.account.email,
          role: signedIn.account.role, isAuthenticated: true
        });
      }
      setNewAccount({ name: '', email: '', username: '', role: 'Maintenance Engineer', password: '', confirm: '' });
      setError(auditWarning);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (ar ? 'تعذر إنشاء الحساب.' : 'Account creation failed.'));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    try {
      await appendAuditRecord({
        actorId: currentUser.id, actorRole: currentUser.role, action: 'LOCAL_LOGOUT',
        entityType: 'account', entityId: currentUser.id, detail: 'Local device session ended.'
      });
    } catch { /* Preserve the ability to end a local session if audit storage is unavailable. */ }
    endLocalSession();
    onSessionChange(null);
    await refresh();
  };

  return <div className="security-center">
    <div className="security-overview surface-card">
      <div className="security-status-mark"><span/></div>
      <div className="security-overview-copy">
        <span className="eyebrow">LOCAL IDENTITY / ACCESS CONTROL</span>
        <h2>{ar ? 'مركز الهوية والأمان المحلي' : 'Local Identity & Security Center'}</h2>
        <p>{ar
          ? 'حسابات محلية بكلمات مرور مشتقة تشفيريًا، وجلسة مؤقتة وسجل تدقيق مترابط.'
          : 'Device-local accounts with derived password hashes, expiring sessions and a tamper-evident audit chain.'}</p>
      </div>
      <span className={'security-state-pill ' + (isAuthenticated ? 'is-authenticated' : 'is-guest')}>
        {isAuthenticated ? (ar ? 'جلسة موثقة محليًا' : 'LOCAL SESSION ACTIVE') : (ar ? 'وضع زائر' : 'GUEST / PREVIEW')}
      </span>
    </div>

    {isAuthenticated ? <div className="surface-card security-session-card">
      <div><span className="eyebrow">SIGNED-IN IDENTITY</span><h3>{currentUser.name}</h3><p>{currentUser.email} · {currentUser.role}</p></div>
      <button className="btn-danger" type="button" onClick={() => void signOut()}>{ar ? 'تسجيل الخروج' : 'Sign out'}</button>
    </div> : <div className="security-forms-grid">
      <form className="surface-card stack-form security-form" onSubmit={submitLogin}>
        <div className="card-head"><div><span className="eyebrow">EXISTING LOCAL IDENTITY</span><h3>{ar ? 'تسجيل الدخول' : 'Sign in'}</h3></div></div>
        <label>{ar ? 'اسم المستخدم أو البريد الإلكتروني' : 'Username or email'}<input value={login.identity} onChange={event => setLogin({ ...login, identity: event.target.value })} autoComplete="username" required/></label>
        <label>{ar ? 'كلمة المرور' : 'Password'}<input type="password" value={login.password} onChange={event => setLogin({ ...login, password: event.target.value })} autoComplete="current-password" required/></label>
        <button className="btn-primary" type="submit" disabled={busy || accounts.length === 0 || Boolean(registryError)}>{busy ? (ar ? 'جارٍ التحقق…' : 'Verifying…') : (ar ? 'دخول آمن محلي' : 'Sign in locally')}</button>
        {accounts.length === 0 && !registryError && <p className="muted-text">{ar ? 'أنشئ حساب المسؤول الأول من النموذج المقابل لبدء استخدام تسجيل الدخول.' : 'Create the first local administrator account in the adjacent form to enable sign-in.'}</p>}
      </form>

      <form className="surface-card stack-form security-form" onSubmit={submitCreate}>
        <div className="card-head"><div><span className="eyebrow">{canBootstrap ? 'FIRST-DEVICE SETUP' : 'ACCOUNT PROVISIONING'}</span><h3>{canBootstrap ? (ar ? 'إنشاء المسؤول الأول' : 'Bootstrap first administrator') : (ar ? 'إنشاء حساب محلي' : 'Create local account')}</h3></div></div>
        <label>{ar ? 'الاسم الكامل' : 'Full name'}<input value={newAccount.name} onChange={event => setNewAccount({ ...newAccount, name: event.target.value })} autoComplete="name" required/></label>
        <label>{ar ? 'البريد الإلكتروني' : 'Email'}<input type="email" value={newAccount.email} onChange={event => setNewAccount({ ...newAccount, email: event.target.value })} autoComplete="email" required/></label>
        <label>{ar ? 'اسم المستخدم' : 'Username'}<input value={newAccount.username} onChange={event => setNewAccount({ ...newAccount, username: event.target.value })} autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9._-]+" required/></label>
        {!canBootstrap && <label>{ar ? 'الدور' : 'Role'}<select value={newAccount.role} onChange={event => setNewAccount({ ...newAccount, role: event.target.value as Role })}>{roles.map(role => <option key={role}>{role}</option>)}</select></label>}
        <label>{ar ? 'كلمة المرور (12 حرفًا على الأقل)' : 'Password (12 characters minimum)'}<input type="password" value={newAccount.password} onChange={event => setNewAccount({ ...newAccount, password: event.target.value })} autoComplete="new-password" minLength={12} maxLength={128} required/></label>
        <label>{ar ? 'تأكيد كلمة المرور' : 'Confirm password'}<input type="password" value={newAccount.confirm} onChange={event => setNewAccount({ ...newAccount, confirm: event.target.value })} autoComplete="new-password" minLength={12} maxLength={128} required/></label>
        <button className="btn-primary" type="submit" disabled={busy || !canManageAccounts}>{busy ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : (ar ? 'حفظ الحساب وبدء الجلسة' : 'Save account & start session')}</button>
        {!canManageAccounts && <p className="muted-text">{ar ? 'يلزم تسجيل دخول المسؤول الأعلى لإضافة حسابات أخرى.' : 'An authenticated Super Admin must sign in before additional accounts can be provisioned.'}</p>}
      </form>
    </div>}

    {registryError && <div className="security-error" role="alert">{ar ? `توقف إنشاء الحسابات لحماية السجلات الحالية: ${registryError}` : `Account provisioning is locked to protect existing identities: ${registryError}`}</div>}
    {error && <div className="security-error" role="alert">{error}</div>}

    <div className="security-integrity-grid">
      <section className="surface-card security-integrity-card">
        <span className="eyebrow">AUDIT CHAIN / SHA-256</span>
        <div className="integrity-heading"><h3>{ar ? 'سلامة سجل التدقيق' : 'Audit log integrity'}</h3><span className={'integrity-indicator ' + (auditIntegrity?.valid ? 'valid' : 'invalid')}/></div>
        <strong>{auditIntegrity === null ? (ar ? 'جارٍ الفحص' : 'Checking…') : auditIntegrity.valid ? (ar ? 'سلسلة السجل سليمة' : 'CHAIN VERIFIED') : (ar ? 'تم اكتشاف تغيير' : 'TAMPERING DETECTED')}</strong>
        <p>{auditIntegrity
          ? `${auditIntegrity.archivedChecked + auditIntegrity.activeChecked} ${ar ? 'سجل تم فحصه' : 'records verified'} · ${auditIntegrity.archiveCount} ${ar ? 'أرشيف' : 'archives'}`
          : (ar ? 'يتم فحص السجلات المحفوظة على هذا الجهاز.' : 'Verifying records stored on this device.')}</p>
        {auditIntegrity && !auditIntegrity.valid && <p className="security-error">{auditIntegrity.reason || (ar ? `أرشيف: ${auditIntegrity.brokenArchiveIndex ?? '—'} · سجل: ${auditIntegrity.brokenRecordIndex ?? '—'}` : `Archive: ${auditIntegrity.brokenArchiveIndex ?? '—'} · record: ${auditIntegrity.brokenRecordIndex ?? '—'}`)}</p>}
      </section>
      {isAdministrator && <section className="surface-card security-integrity-card">
        <span className="eyebrow">LOCAL ACCOUNTS / DEVICE ONLY</span>
        <div className="integrity-heading"><h3>{ar ? 'الحسابات المسجلة' : 'Registered accounts'}</h3><strong>{accounts.length}</strong></div>
        {accounts.length === 0 ? <p>{ar ? 'لم يتم إنشاء حسابات بعد.' : 'No local accounts have been created yet.'}</p> : accounts.map(account => <div className="local-account-row" key={account.id}><strong>{account.name}</strong><span>{account.username} · {account.role}</span></div>)}
      </section>}
      {!isAdministrator && isAuthenticated && <section className="surface-card security-integrity-card"><span className="eyebrow">LOCAL IDENTITY</span><h3>{ar ? 'الحساب الحالي' : 'Current account'}</h3><p>{currentUser.name} · {currentUser.role}</p></section>}
    </div>

    {isAdministrator && <section className="surface-card security-audit-list">
      <div className="card-head"><div><span className="eyebrow">AUDIT LEDGER / ARCHIVES / EXPORT</span><h3>{ar ? 'سجل التدقيق والأرشيف' : 'Audit ledger & archives'}</h3></div><span className="counter">{recentAudit.length} / {auditRecords.length}</span></div>
      <div className="audit-toolbar">
        <label>{ar ? 'بحث' : 'Search'}<input value={auditQuery} onChange={event => setAuditQuery(event.target.value)} placeholder={ar ? 'بحث في الحدث أو المستخدم أو السجل' : 'Search action, user or record'}/></label>
        <label>{ar ? 'العملية' : 'Action'}<select value={auditActionFilter} onChange={event => setAuditActionFilter(event.target.value)}><option value="">{ar ? 'كل العمليات' : 'All actions'}</option>{auditActions.map(action => <option key={action}>{action}</option>)}</select></label>
        <label>{ar ? 'نوع السجل' : 'Entity type'}<select value={auditEntityFilter} onChange={event => setAuditEntityFilter(event.target.value)}><option value="">{ar ? 'كل الأنواع' : 'All types'}</option>{auditEntities.map(entity => <option key={entity}>{entity}</option>)}</select></label>
      </div>
      <div className="audit-toolbar-actions">
        <button className="btn-secondary" type="button" disabled={auditBusy || !auditIntegrity?.valid} onClick={() => void exportAuditJson()}>{ar ? 'تصدير JSON' : 'Export JSON'}</button>
        <button className="btn-secondary" type="button" disabled={auditBusy || !auditIntegrity?.valid} onClick={() => void exportAuditCsv()}>{ar ? 'تصدير CSV' : 'Export CSV'}</button>
        {currentUser.role === 'Super Admin' && <button className="btn-primary" type="button" disabled={auditBusy || !auditIntegrity?.valid || auditIntegrity.activeChecked === 0} onClick={() => void archiveActiveAudit()}>{auditBusy ? (ar ? 'جارٍ التنفيذ…' : 'Working…') : (ar ? 'أرشفة السجل النشط' : 'Archive active ledger')}</button>}
      </div>
      {recentAudit.length === 0 ? <p className="muted-text">{ar ? 'لا توجد أحداث تطابق الفلاتر الحالية.' : 'No audit events match the current filters.'}</p> : recentAudit.map(record => <div className="audit-event-row" key={record.id}><div><strong>{record.action}</strong><span>{record.actorId} · {record.actorRole} · {record.entityType} · {record.entityId}</span>{record.detail && <small>{record.detail}</small>}</div><time>{new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(record.timestamp))}</time></div>)}
      <p className="muted-text">{ar
        ? 'الأرشيف والسجل نشطان على هذا الجهاز. تصدير JSON يحفظ بيانات الأرشيف وسلسلة البصمات؛ الاحتفاظ المحلي يظل مقيداً بسعة المتصفح ولا يمثل تخزيناً مركزياً.'
        : 'Archives and active events are stored on this device. JSON export contains archive manifests and hash chains. Local retention remains limited by browser storage quota and is not centralized storage.'}</p>
    </section>}

    <div className="notice-inline"><span>ⓘ</span>{ar
      ? 'تنبيه: هذا نظام هوية محلي على الجهاز نفسه. لا يوفر إدارة مركزية أو استعادة حسابات أو صلاحيات خادمية؛ يجب استخدام خادم هوية وصلاحيات خلفية قبل نشر متعدد المستخدمين أو عبر الشبكة.'
      : 'Security boundary: this is device-local identity only. It does not provide centralized identity, remote revocation or server-side authorization. A shared or networked deployment requires a trusted identity provider and backend permission enforcement.'}</div>
  </div>;
}
