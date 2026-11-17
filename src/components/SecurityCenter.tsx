import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Language, Role, User } from '../types';
import { appendAuditRecord, readAuditRecords, verifyAuditChain } from '../security/auditLog';
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
  const [auditIntegrity, setAuditIntegrity] = useState<{ valid: boolean; checked: number; brokenIndex: number | null; reason?: string } | null>(null);
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
      const result = await verifyAuditChain(readAuditRecords(localStorage));
      setAuditIntegrity(result);
    } catch (reason) {
      setAuditIntegrity({ valid: false, checked: 0, brokenIndex: 0, reason: reason instanceof Error ? reason.message : 'Audit log could not be read.' });
    }
  };

  useEffect(() => { void refresh(); }, []);

  const recentAudit = useMemo(() => {
    try { return readAuditRecords(localStorage).slice(-8).reverse(); }
    catch { return []; }
  }, [auditIntegrity, accounts.length]);

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
        <p>{auditIntegrity ? `${auditIntegrity.checked} ${ar ? 'سجل تم فحصه' : 'records checked'}` : (ar ? 'يتم فحص السجلات المحفوظة على هذا الجهاز.' : 'Verifying records stored on this device.')}</p>
        {auditIntegrity && !auditIntegrity.valid && <p className="security-error">{auditIntegrity.reason || (ar ? `موضع الخلل: ${auditIntegrity.brokenIndex}` : `Broken record index: ${auditIntegrity.brokenIndex}`)}</p>}
      </section>
      {isAdministrator && <section className="surface-card security-integrity-card">
        <span className="eyebrow">LOCAL ACCOUNTS / DEVICE ONLY</span>
        <div className="integrity-heading"><h3>{ar ? 'الحسابات المسجلة' : 'Registered accounts'}</h3><strong>{accounts.length}</strong></div>
        {accounts.length === 0 ? <p>{ar ? 'لم يتم إنشاء حسابات بعد.' : 'No local accounts have been created yet.'}</p> : accounts.map(account => <div className="local-account-row" key={account.id}><strong>{account.name}</strong><span>{account.username} · {account.role}</span></div>)}
      </section>}
      {!isAdministrator && isAuthenticated && <section className="surface-card security-integrity-card"><span className="eyebrow">LOCAL IDENTITY</span><h3>{ar ? 'الحساب الحالي' : 'Current account'}</h3><p>{currentUser.name} · {currentUser.role}</p></section>}
    </div>

    {isAdministrator && <section className="surface-card security-audit-list">
      <div className="card-head"><div><span className="eyebrow">RECENT SECURITY EVENTS</span><h3>{ar ? 'أحدث أحداث الأمان' : 'Recent security events'}</h3></div><span className="counter">{recentAudit.length}</span></div>
      {recentAudit.length === 0 ? <p className="muted-text">{ar ? 'لا توجد أحداث مسجلة بعد.' : 'No security events recorded yet.'}</p> : recentAudit.map(record => <div className="audit-event-row" key={record.id}><div><strong>{record.action}</strong><span>{record.actorRole} · {record.entityType} · {record.entityId}</span></div><time>{new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(record.timestamp))}</time></div>)}
    </section>}

    <div className="notice-inline"><span>ⓘ</span>{ar
      ? 'تنبيه: هذا نظام هوية محلي على الجهاز نفسه. لا يوفر إدارة مركزية أو استعادة حسابات أو صلاحيات خادمية؛ يجب استخدام خادم هوية وصلاحيات خلفية قبل نشر متعدد المستخدمين أو عبر الشبكة.'
      : 'Security boundary: this is device-local identity only. It does not provide centralized identity, remote revocation or server-side authorization. A shared or networked deployment requires a trusted identity provider and backend permission enforcement.'}</div>
  </div>;
}
