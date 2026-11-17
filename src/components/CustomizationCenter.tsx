import { useMemo, useState } from 'react';
import type { Role } from '../types';
import {
  appendCustomizationAudit,
  DEFAULT_CUSTOMIZATION,
  loadCustomization,
  PROTECTED_ROUTES,
  saveCustomization,
  type CustomizableRoute,
  type CustomizationConfig
} from '../data/applicationCustomization';

export interface CustomizationCenterProps {
  /** This is a local UI permission guard only; it is not authentication/RBAC. */
  canManage: boolean;
  roles?: readonly Role[];
  onChange?: (config: CustomizationConfig) => void;
}

/** Reusable customization screen. Persisted preferences affect presentation only, never business data or device control. */
export default function CustomizationCenter({ canManage, roles = ['Super Admin', 'Admin', 'Supervisor', 'Maintenance Engineer', 'Technician', 'Operator', 'Viewer'], onChange }: CustomizationCenterProps) {
  const [config, setConfig] = useState(loadCustomization);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<'modules' | 'navigation' | 'dashboard'>('modules');
  const [draftLabel, setDraftLabel] = useState('');
  const [draftGroup, setDraftGroup] = useState('CUSTOM');
  const [newRoute, setNewRoute] = useState<CustomizableRoute>('reports');
  const [roleTarget, setRoleTarget] = useState<Role>('Viewer');
  const [audit, setAudit] = useState(() => {
    try { return JSON.parse(localStorage.getItem('shuttle-car-automation-v7:customization-audit') || '[]') as Array<{id:string;timestamp:string;action:string;target:string;detail:string}>; }
    catch { return []; }
  });

  const commit = (next: CustomizationConfig, action: string, target: string, detail: string) => {
    if (!canManage) return;
    setConfig(next);
    try {
      saveCustomization(next);
      const record = appendCustomizationAudit({ action, target, detail });
      setAudit((current) => [record, ...current].slice(0, 500));
      onChange?.(next);
      setMessage('Saved on this device. This is a local display preference, not an access-control boundary.');
    } catch {
      setMessage('Could not save customization. Check local device storage.');
    }
  };

  const reorder = <T extends {order:number}>(items: T[], index: number, delta: number): T[] => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return items;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    return next.map((item, order) => ({ ...item, order }));
  };

  const options = useMemo(() => config.modules.filter((module) => module.id !== 'dashboard' && module.id !== 'settings'), [config.modules]);
  const restore = () => {
    if (!window.confirm('Restore default module, navigation and dashboard preferences? This does not delete application records.')) return;
    commit(DEFAULT_CUSTOMIZATION, 'RESTORE_DEFAULTS', 'customization', 'Restored default local presentation preferences.');
  };

  const addNavigation = () => {
    const label = draftLabel.trim();
    if (!canManage || !label) { setMessage('Enter a label before adding a menu entry.'); return; }
    const module = config.modules.find((item) => item.id === newRoute);
    if (!module?.enabled || config.navigation.some((item) => item.route === newRoute)) { setMessage('Choose an enabled route that is not already in the menu.'); return; }
    const next = { ...config, navigation: [...config.navigation, { route: newRoute, label: label.slice(0, 80), group: draftGroup.trim().slice(0, 40) || 'CUSTOM', visible: true, order: config.navigation.length }] };
    commit(next, 'ADD_NAVIGATION_ENTRY', newRoute, `Added local menu label “${label.slice(0,80)}”.`);
    setDraftLabel('');
  };

  return <section className="surface-card customization-center" aria-labelledby="customization-title">
    <header className="card-head"><div><span className="eyebrow">APPLICATION PRESENTATION / LOCAL PREFERENCES</span><h2 id="customization-title">Customization center</h2></div><button className="btn-secondary" type="button" onClick={restore} disabled={!canManage}>Restore defaults</button></header>
    <p className="muted-text">Configure visible modules, menu labels/order and dashboard widgets. Changes are saved to this device only. Hiding a screen does not delete records, and local role selection is not secure authentication.</p>
    {!canManage && <p className="notice-inline" role="note">Management is disabled for this role preview. This client-side check is not server-enforced authorization.</p>}
    <div className="choice-row" role="tablist" aria-label="Customization areas">
      {(['modules','navigation','dashboard'] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={tab===item} className={tab===item?'selected':''} onClick={() => setTab(item)}>{item==='modules'?'Modules':item==='navigation'?'Navigation':'Dashboard widgets'}</button>)}
    </div>
    {tab==='modules' && <div className="customization-list">{config.modules.map((module) => <article key={module.id} className="customization-row">
      <div className="customization-copy"><strong>{module.label}</strong><small>{module.description}</small><code>{module.id}</code></div>
      <label className="setting-toggle"><span><strong>Enabled</strong></span><input aria-label={`Enable ${module.label}`} type="checkbox" checked={module.enabled} disabled={!canManage || PROTECTED_ROUTES.includes(module.id)} onChange={(event) => commit({ ...config, modules: config.modules.map((item) => item.id===module.id ? { ...item, enabled:event.target.checked } : item), navigation: config.navigation.map((item) => item.route===module.id ? { ...item, visible:event.target.checked } : item) }, event.target.checked?'ENABLE_MODULE':'DISABLE_MODULE', module.id, `Module ${event.target.checked?'enabled':'disabled'} locally.`)} /></label>
      <label className="custom-role"><span>Hide from role</span><select aria-label={`Role visibility ${module.label}`} value={module.hiddenForRoles[0] || ''} disabled={!canManage || PROTECTED_ROUTES.includes(module.id)} onChange={(event) => commit({ ...config, modules: config.modules.map((item) => item.id===module.id ? { ...item, hiddenForRoles: event.target.value ? [event.target.value as Role] : [] } : item) }, 'CHANGE_MODULE_VISIBILITY', module.id, `Changed local visibility for ${event.target.value || 'all roles'}.`)}><option value="">All roles</option>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
    </article>)}</div>}
    {tab==='navigation' && <><div className="customization-list">{config.navigation.map((item, index) => <article key={item.route} className="customization-row">
      <div className="customization-copy"><strong>{item.label}</strong><small>{item.group} · route: {item.route}</small></div>
      <label className="custom-role"><span>Label</span><input aria-label={`Menu label ${item.label}`} disabled={!canManage} value={item.label} maxLength={80} onChange={(event) => setConfig((current) => ({ ...current, navigation: current.navigation.map((entry) => entry.route===item.route ? { ...entry, label:event.target.value } : entry) }))} onBlur={() => { const changed=config.navigation.find((entry)=>entry.route===item.route); const original=DEFAULT_CUSTOMIZATION.navigation.find((entry)=>entry.route===item.route); if(changed && original && changed.label!==original.label) commit(config,'EDIT_NAVIGATION_LABEL',item.route,`Updated menu label to “${changed.label}”.`); }} /></label>
      <label className="setting-toggle"><span><strong>Visible</strong></span><input aria-label={`Show menu ${item.label}`} type="checkbox" checked={item.visible && config.modules.find((module)=>module.id===item.route)?.enabled!==false} disabled={!canManage || PROTECTED_ROUTES.includes(item.route)} onChange={(event) => commit({ ...config, navigation: config.navigation.map((entry)=>entry.route===item.route?{...entry,visible:event.target.checked}:entry) },event.target.checked?'SHOW_NAVIGATION':'HIDE_NAVIGATION',item.route,'Changed local navigation visibility; records are retained.')} /></label>
      <div className="custom-order"><button type="button" className="btn-secondary" aria-label={`Move ${item.label} up`} disabled={!canManage || index===0} onClick={()=>commit({...config,navigation:reorder(config.navigation,index,-1)},'REORDER_NAVIGATION',item.route,'Moved navigation entry up.')}>↑</button><button type="button" className="btn-secondary" aria-label={`Move ${item.label} down`} disabled={!canManage || index===config.navigation.length-1} onClick={()=>commit({...config,navigation:reorder(config.navigation,index,1)},'REORDER_NAVIGATION',item.route,'Moved navigation entry down.')}>↓</button></div>
    </article>)}</div><div className="customization-add"><label>Menu label<input aria-label="New menu label" value={draftLabel} onChange={(event)=>setDraftLabel(event.target.value)} maxLength={80} /></label><label>Existing destination<select aria-label="Existing destination" value={newRoute} onChange={(event)=>setNewRoute(event.target.value as CustomizableRoute)}>{options.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Group<input aria-label="Navigation group" value={draftGroup} onChange={(event)=>setDraftGroup(event.target.value)} maxLength={40}/></label><button type="button" className="btn-primary" disabled={!canManage} onClick={addNavigation}>Add menu alias</button><small>Aliases only link to an existing application destination. They cannot create arbitrary routes or actions.</small></div></>}
    {tab==='dashboard' && <div className="customization-list">{config.dashboard.map((widget,index)=><article key={widget.id} className="customization-row"><div className="customization-copy"><strong>{widget.label}</strong><small>Widget: {widget.id}</small></div><label className="setting-toggle"><span><strong>Visible</strong></span><input aria-label={`Show widget ${widget.label}`} type="checkbox" checked={widget.visible} disabled={!canManage} onChange={(event)=>commit({...config,dashboard:config.dashboard.map((item)=>item.id===widget.id?{...item,visible:event.target.checked}:item)},event.target.checked?'SHOW_WIDGET':'HIDE_WIDGET',widget.id,'Changed local dashboard widget visibility.')} /></label><label className="custom-role"><span>Size</span><select aria-label={`Widget size ${widget.label}`} value={widget.size} disabled={!canManage} onChange={(event)=>commit({...config,dashboard:config.dashboard.map((item)=>item.id===widget.id?{...item,size:event.target.value as 'compact'|'wide'}:item)},'RESIZE_WIDGET',widget.id,`Set widget size to ${event.target.value}.`)}><option value="compact">Compact</option><option value="wide">Wide</option></select></label><div className="custom-order"><button type="button" className="btn-secondary" aria-label={`Move widget ${widget.label} up`} disabled={!canManage||index===0} onClick={()=>commit({...config,dashboard:reorder(config.dashboard,index,-1)},'REORDER_WIDGET',widget.id,'Moved dashboard widget up.')}>↑</button><button type="button" className="btn-secondary" aria-label={`Move widget ${widget.label} down`} disabled={!canManage||index===config.dashboard.length-1} onClick={()=>commit({...config,dashboard:reorder(config.dashboard,index,1)},'REORDER_WIDGET',widget.id,'Moved dashboard widget down.')}>↓</button></div></article>)}</div>}
    {message && <p role="status" className="customization-message">{message}</p>}
    <details className="customization-audit"><summary>Local customization audit ({audit.length})</summary>{audit.length===0?<p className="muted-text">No customization actions recorded.</p>:<ol>{audit.slice(0,30).map((entry)=><li key={entry.id}><time>{entry.timestamp}</time> · <strong>{entry.action}</strong> · {entry.target} — {entry.detail}</li>)}</ol>}<p className="muted-text">This audit log is local-device data and can be modified by a user with access to this browser/device.</p></details>
  </section>;
}
