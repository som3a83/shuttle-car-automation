import React, { useState } from 'react';
import type { Fault, Language, MaintenanceJob, ShiftRecord, Shuttle } from '../types';

interface ShiftOperationsProps {
  language: Language;
  shifts: ShiftRecord[];
  shuttles: Shuttle[];
  faults: Fault[];
  jobs: MaintenanceJob[];
  onChange: (next: ShiftRecord[]) => void;
}

function downloadCsv(rows: Array<Array<string | number>>) {
  const csv = rows.map(row => row.map(value => '"' + String(value ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'shuttle-shift-handover.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export default function ShiftOperations({ language, shifts, shuttles, faults, jobs, onChange }: ShiftOperationsProps) {
  const ar = language === 'ar';
  const [shiftType, setShiftType] = useState<'Day' | 'Night'>('Day');
  const [supervisor, setSupervisor] = useState('');
  const [operators, setOperators] = useState('');
  const [openingNotes, setOpeningNotes] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [pendingArchiveShiftId, setPendingArchiveShiftId] = useState<string | null>(null);
  const [showArchivedShifts, setShowArchivedShifts] = useState(false);
  const activeShifts = shifts.filter(item => !item.archivedAt);
  const archivedShifts = shifts.filter(item => Boolean(item.archivedAt));
  const openShift = activeShifts.find(item => !item.endedAt) || null;
  const activeShuttles = shuttles.filter(item => !item.archivedAt);
  const openFaults = faults.filter(item => item.status !== 'Resolved').length;
  const openJobs = jobs.filter(item => item.status !== 'Completed').length;

  const startShift = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (openShift || !supervisor.trim() || !operators.trim()) return;
    const now = new Date();
    const id = 'SHF-' + now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const record: ShiftRecord = {
      id,
      shiftType,
      startedAt: now.toISOString(),
      endedAt: null,
      supervisor: supervisor.trim(),
      operators: operators.trim(),
      openingNotes: openingNotes.trim(),
      handoverNotes: '',
      openingFleet: activeShuttles.map(item => ({ id: item.id, manufacturer: item.manufacturer, status: item.status, connectivity: item.connectivity })),
      closingFleet: [],
      openingOpenFaults: openFaults,
      closingOpenFaults: null,
      openingOpenMaintenance: openJobs,
      closingOpenMaintenance: null
    };
    onChange([record, ...shifts]);
    setOpeningNotes('');
  };

  const closeShift = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!openShift || !handoverNotes.trim()) return;
    const now = new Date().toISOString();
    onChange(shifts.map(item => item.id === openShift.id ? {
      ...item,
      endedAt: now,
      handoverNotes: handoverNotes.trim(),
      closingFleet: activeShuttles.map(unit => ({ id: unit.id, manufacturer: unit.manufacturer, status: unit.status, connectivity: unit.connectivity })),
      closingOpenFaults: openFaults,
      closingOpenMaintenance: openJobs
    } : item));
    setHandoverNotes('');
  };

  const saveShiftEdit = (event: React.FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextSupervisor = String(form.get('supervisor') || '').trim();
    const nextOperators = String(form.get('operators') || '').trim();
    if (!nextSupervisor || !nextOperators) return;
    onChange(shifts.map(item => item.id === id ? {
      ...item,
      shiftType: String(form.get('shiftType') || item.shiftType) as ShiftRecord['shiftType'],
      supervisor: nextSupervisor,
      operators: nextOperators,
      openingNotes: String(form.get('openingNotes') || '').trim(),
      handoverNotes: String(form.get('handoverNotes') || '').trim()
    } : item));
    setEditingShiftId(null);
  };

  const archiveShift = (id: string) => {
    const target = shifts.find(item => item.id === id && !item.archivedAt);
    if (!target || !target.endedAt) return;
    onChange(shifts.map(item => item.id === id ? { ...item, archivedAt: new Date().toISOString() } : item));
    setPendingArchiveShiftId(null);
    setEditingShiftId(null);
  };

  const restoreShift = (id: string) => {
    onChange(shifts.map(item => item.id === id ? { ...item, archivedAt: null } : item));
  };

  const formatTime = (value: string | null) => {
    if (!value) return ar ? 'مفتوحة' : 'Open';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };

  return <section className="page-content shift-operations-page">
    <div className="page-intro">
      <div><span className="eyebrow">SHIFT CONTROL / HANDOVER REGISTER</span>
        <h2>{ar ? 'إدارة الورديات وتسليم التشغيل' : 'Shift operations & handover'}</h2>
        <p>{ar ? 'تسجيل بداية ونهاية الوردية، مسؤول التشغيل، فريق العمل، حالة الأسطول وملاحظات التسليم.' : 'Record shift start and close, accountable supervisor, operators, fleet snapshots and handover notes.'}</p>
      </div>
      <div className="shift-live-indicator"><i className={openShift ? 'live' : ''}/>{openShift ? (ar ? 'وردية مفتوحة' : 'SHIFT OPEN') : (ar ? 'لا توجد وردية مفتوحة' : 'NO OPEN SHIFT')}</div>
    </div>

    <div className="shift-metric-grid">
      <div className="metric-card"><span>{ar ? 'الورديات المسجلة' : 'Recorded shifts'}</span><strong>{activeShifts.length}</strong></div>
      <div className="metric-card"><span>{ar ? 'الأجهزة النشطة الآن' : 'Active fleet'}</span><strong>{activeShuttles.length}</strong></div>
      <div className="metric-card"><span>{ar ? 'الأعطال المفتوحة' : 'Open faults'}</span><strong>{openFaults}</strong></div>
      <div className="metric-card"><span>{ar ? 'أوامر الصيانة المفتوحة' : 'Open maintenance'}</span><strong>{openJobs}</strong></div>
    </div>

    {openShift ? <div className="surface-card shift-open-card">
      <div className="card-head"><div><span className="eyebrow">{ar ? 'الوردية الحالية' : 'CURRENT SHIFT'}</span><h3>{openShift.id} · {openShift.shiftType === 'Day' ? (ar ? 'صباحية' : 'Day') : (ar ? 'ليلية' : 'Night')}</h3></div><span className="status-pill status-running">{ar ? 'مفتوحة' : 'OPEN'}</span></div>
      <div className="shift-details-grid">
        <div><small>{ar ? 'المشرف' : 'Supervisor'}</small><strong>{openShift.supervisor}</strong></div>
        <div><small>{ar ? 'فريق التشغيل' : 'Operators'}</small><strong>{openShift.operators}</strong></div>
        <div><small>{ar ? 'وقت البداية' : 'Started'}</small><strong>{formatTime(openShift.startedAt)}</strong></div>
        <div><small>{ar ? 'أجهزة عند البداية' : 'Opening fleet snapshot'}</small><strong>{openShift.openingFleet.length}</strong></div>
      </div>
      <div className="shift-opening-assets">
        <div className="eyebrow">{ar ? 'حالة الأجهزة عند استلام الوردية' : 'EQUIPMENT STATE AT SHIFT OPEN'}</div>
        <div className="shift-opening-assets-list">
          {openShift.openingFleet.length === 0
            ? <span className="muted-text">{ar ? 'لا توجد أجهزة نشطة في لقطة البداية.' : 'No active shuttles in the opening snapshot.'}</span>
            : openShift.openingFleet.map(unit => <div className="shift-opening-asset" key={unit.id}>
                <strong>{unit.id}</strong><span>{unit.manufacturer}</span><span>{unit.status}</span><small>{unit.connectivity}</small>
              </div>)}
        </div>
      </div>
      {openShift.openingNotes && <p className="shift-notes">{openShift.openingNotes}</p>}
      <form className="stack-form shift-close-form" onSubmit={closeShift}>
        <label>{ar ? 'ملاحظات التسليم للوردية التالية *' : 'Handover notes for the next shift *'}
          <textarea value={handoverNotes} onChange={event => setHandoverNotes(event.target.value)} required minLength={3} placeholder={ar ? 'سجّل حالة الأجهزة المتوقفة، الأعطال المفتوحة، البطاريات، والأعمال التي لم تكتمل...' : 'Record stopped units, open faults, battery status and unfinished work...'}/>
        </label>
        <button className="btn-primary" type="submit" disabled={handoverNotes.trim().length < 3}>{ar ? 'إغلاق الوردية وحفظ التسليم' : 'Close shift & save handover'}</button>
      </form>
    </div> : <div className="surface-card shift-start-card">
      <div className="card-head"><div><span className="eyebrow">{ar ? 'بدء وردية تشغيل' : 'START OPERATING SHIFT'}</span><h3>{ar ? 'تسجيل الوردية الجديدة' : 'Register a new shift'}</h3></div><span className="counter">{ar ? 'متاحة' : 'READY'}</span></div>
      <form className="form-grid shift-start-form" onSubmit={startShift}>
        <label>{ar ? 'نوع الوردية' : 'Shift type'}<select value={shiftType} onChange={event => setShiftType(event.target.value as 'Day' | 'Night')}><option value="Day">{ar ? 'صباحية' : 'Day shift'}</option><option value="Night">{ar ? 'ليلية' : 'Night shift'}</option></select></label>
        <label>{ar ? 'مشرف الوردية *' : 'Shift supervisor *'}<input value={supervisor} onChange={event => setSupervisor(event.target.value)} required maxLength={80}/></label>
        <label>{ar ? 'أسماء المشغلين والفنيين *' : 'Operators / technicians *'}<input value={operators} onChange={event => setOperators(event.target.value)} required maxLength={180}/></label>
        <label className="wide-field">{ar ? 'ملاحظات بداية الوردية' : 'Opening notes'}<textarea value={openingNotes} onChange={event => setOpeningNotes(event.target.value)} maxLength={1200} placeholder={ar ? 'حالة الأسطول، ملاحظات الاستلام، أعمال الصيانة القائمة...' : 'Fleet condition, shift acceptance notes, maintenance in progress...'}/></label>
        <div className="shift-start-summary"><strong>{ar ? 'سيتم حفظ لقطة بداية الوردية' : 'Opening shift snapshot'}</strong><span>{ar ? `${activeShuttles.length} جهاز · ${openFaults} عطل مفتوح · ${openJobs} أمر صيانة مفتوح` : `${activeShuttles.length} shuttles · ${openFaults} open faults · ${openJobs} open work orders`}</span></div>
        <button className="btn-primary" type="submit" disabled={!supervisor.trim() || !operators.trim()}>{ar ? 'بدء الوردية الآن' : 'Start shift now'}</button>
      </form>
    </div>}

    <div className="surface-card shift-history-card">
      <div className="card-head"><div><span className="eyebrow">{ar ? 'سجل الورديات' : 'SHIFT HISTORY'}</span><h3>{ar ? 'الورديات السابقة ومحاضر التسليم' : 'Previous shifts & handover records'}</h3></div><button className="btn-secondary" type="button" onClick={() => downloadCsv([
        ['ID','Shift','Started','Ended','Supervisor','Operators','Opening faults','Closing faults','Opening notes','Handover notes'],
        ...activeShifts.map(item => [item.id,item.shiftType,item.startedAt,item.endedAt || 'OPEN',item.supervisor,item.operators,item.openingOpenFaults,item.closingOpenFaults ?? '',item.openingNotes,item.handoverNotes])
      ])} disabled={activeShifts.length === 0}>{ar ? 'تصدير سجل الورديات CSV' : 'Export shift register CSV'}</button></div>
      {activeShifts.length === 0 ? <div className="empty-state">{ar ? 'لم يتم تسجيل ورديات بعد. ابدأ أول وردية لتفعيل سجل التسليم.' : 'No shifts yet. Start the first shift to activate handover records.'}</div> :
        <div className="shift-history-list">{activeShifts.map(item => <article className="shift-history-item" key={item.id}>
          <div className="record-top"><div><span className="eyebrow">{item.id} · {item.shiftType === 'Day' ? (ar ? 'صباحية' : 'DAY') : (ar ? 'ليلية' : 'NIGHT')}</span><h3>{item.supervisor}</h3></div><span className={'status-pill ' + (item.endedAt ? 'status-completed' : 'status-running')}>{item.endedAt ? (ar ? 'مغلقة' : 'CLOSED') : (ar ? 'مفتوحة' : 'OPEN')}</span></div>
          {editingShiftId === item.id ? <form className="stack-form record-edit-form" onSubmit={event => saveShiftEdit(event, item.id)}>
            <label>{ar ? 'نوع الوردية' : 'Shift type'}<select name="shiftType" defaultValue={item.shiftType}><option value="Day">{ar ? 'صباحية' : 'Day shift'}</option><option value="Night">{ar ? 'ليلية' : 'Night shift'}</option></select></label>
            <label>{ar ? 'مشرف الوردية *' : 'Shift supervisor *'}<input name="supervisor" defaultValue={item.supervisor} required maxLength={80}/></label>
            <label>{ar ? 'أسماء المشغلين والفنيين *' : 'Operators / technicians *'}<input name="operators" defaultValue={item.operators} required maxLength={180}/></label>
            <label>{ar ? 'ملاحظات بداية الوردية' : 'Opening notes'}<textarea name="openingNotes" defaultValue={item.openingNotes} maxLength={1200}/></label>
            <label>{ar ? 'ملاحظات التسليم' : 'Handover notes'}<textarea name="handoverNotes" defaultValue={item.handoverNotes} maxLength={1200}/></label>
            <div className="record-actions"><button className="btn-primary" type="submit">{ar ? 'حفظ التعديل' : 'Save changes'}</button><button className="btn-secondary" type="button" onClick={() => setEditingShiftId(null)}>{ar ? 'إلغاء' : 'Cancel'}</button></div>
          </form> : <>
            <div className="record-meta"><span>{ar ? 'بداية:' : 'Started:'} {formatTime(item.startedAt)}</span><span>{ar ? 'نهاية:' : 'Ended:'} {formatTime(item.endedAt)}</span><span>{ar ? 'الفريق:' : 'Team:'} {item.operators}</span></div>
            <div className="shift-snapshot-line">{ar ? 'لقطة الأسطول عند البداية:' : 'Opening fleet snapshot:'} {item.openingFleet.length} · {ar ? 'أعطال:' : 'Faults:'} {item.openingOpenFaults} · {ar ? 'صيانة:' : 'Work orders:'} {item.openingOpenMaintenance}</div>
            {item.handoverNotes && <p className="shift-notes">{item.handoverNotes}</p>}
            <div className="record-actions">
              <button className="btn-secondary" type="button" onClick={() => setEditingShiftId(item.id)}>{ar ? 'تعديل السجل' : 'Edit record'}</button>
              {item.endedAt
                ? (pendingArchiveShiftId === item.id
                    ? <><button className="btn-danger" type="button" onClick={() => archiveShift(item.id)}>{ar ? 'تأكيد الأرشفة' : 'Confirm archive'}</button><button className="btn-secondary" type="button" onClick={() => setPendingArchiveShiftId(null)}>{ar ? 'إلغاء' : 'Cancel'}</button></>
                    : <button className="btn-danger" type="button" onClick={() => setPendingArchiveShiftId(item.id)}>{ar ? 'أرشفة' : 'Archive'}</button>)
                : <span className="muted-text">{ar ? 'أغلق الوردية قبل الأرشفة' : 'Close the shift before archiving'}</span>}
            </div>
          </>}
        </article>)}</div>}
      <div className="archive-panel"><button className="text-button" type="button" onClick={() => setShowArchivedShifts(value => !value)}>{showArchivedShifts ? (ar ? 'إخفاء أرشيف الورديات' : 'Hide shift archive') : (ar ? 'عرض الورديات المؤرشفة' : 'Show archived shifts')} · {archivedShifts.length}</button>
        {showArchivedShifts && archivedShifts.map(item => <div className="archive-row" key={item.id}><div><strong>{item.id} · {item.supervisor}</strong><small>{item.shiftType} · {formatTime(item.startedAt)} · {formatTime(item.endedAt)}</small></div><button className="btn-secondary" onClick={() => restoreShift(item.id)}>{ar ? 'استعادة' : 'Restore'}</button></div>)}
      </div>
    </div>
    <p className="shift-footnote">{ar ? 'السجلات محفوظة محليًا على هذا الجهاز. أسماء المشرفين والمشغلين إدخالات تشغيلية وليست إثبات هوية أو توقيعًا إلكترونيًا.' : 'Shift records are stored locally on this device. Supervisor/operator names are operational entries, not authenticated identity or electronic signatures.'}</p>
  </section>;
}
