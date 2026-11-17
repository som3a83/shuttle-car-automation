import { useMemo, useState } from 'react';
import type { Role } from '../types';
import {
  appendCustomizationAudit,
  DEFAULT_CUSTOMIZATION,
  loadCustomization,
  PROTECTED_ROUTES,
  readCustomizationAudit,
  saveCustomization,
  validateCustomization,
  type CustomizableRoute,
  type CustomizationConfig,
  type NavigationPreference
} from '../data/applicationCustomization';

export interface CustomizationCenterProps {
  /** Local presentation guard only; it is not authentication or server authorization. */
  canManage: boolean;
  roles?: readonly Role[];
}

export default function CustomizationCenter({
  canManage,
  roles = ['Super Admin', 'Admin', 'Supervisor', 'Maintenance Engineer', 'Technician', 'Operator', 'Viewer']
}: CustomizationCenterProps) {
  const [config, setConfig] = useState(loadCustomization);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<'modules' | 'navigation' | 'dashboard'>('modules');
  const [draftLabel, setDraftLabel] = useState('');
  const [draftLabelAr, setDraftLabelAr] = useState('');
  const [draftGroup, setDraftGroup] = useState('CUSTOM');
  const [newRoute, setNewRoute] = useState<CustomizableRoute>('reports');
  const [audit, setAudit] = useState(readCustomizationAudit);

  const commit = (next: CustomizationConfig, action: string, target: string, detail: string) => {
    if (!canManage) return;
    const normalized = validateCustomization(next);
    try {
      saveCustomization(normalized);
    } catch {
      setMessage('Could not save customization. Check local device storage.');
      return;
    }
    let auditSaved = true;
    try {
      appendCustomizationAudit({ action, target, detail });
    } catch {
      auditSaved = false;
    }
    setConfig(normalized);
    setAudit(readCustomizationAudit());
    window.dispatchEvent(new CustomEvent<CustomizationConfig>('shuttle-customization-change', { detail: normalized }));
    setMessage(auditSaved
      ? 'Saved on this device. These preferences can be changed by anyone with access to this device.'
      : 'Preferences were saved, but the local audit log could not be updated because device storage is full.');
  };

  const reorder = <T extends { order: number }>(items: T[], index: number, delta: number): T[] => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return items;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    return next.map((item, order) => ({ ...item, order }));
  };

  const destinationOptions = useMemo(
    () => config.modules.filter((module) => module.enabled),
    [config.modules]
  );

  const restore = () => {
    if (!window.confirm('Restore default module, navigation and dashboard preferences? This does not delete application records.')) return;
    commit(DEFAULT_CUSTOMIZATION, 'RESTORE_DEFAULTS', 'customization', 'Restored default local presentation preferences.');
  };

  const saveNavigationField = (id: string, field: 'label' | 'labelAr' | 'group', value: string) => {
    const next = {
      ...config,
      navigation: config.navigation.map((item) => item.id === id ? { ...item, [field]: value } : item)
    };
    commit(next, 'EDIT_NAVIGATION_ENTRY', id, `Updated ${field} for this local navigation entry.`);
  };

  const addAlias = () => {
    const label = draftLabel.trim();
    if (!canManage || !label) {
      setMessage('Enter an English label before adding the menu alias.');
      return;
    }
    const module = config.modules.find((item) => item.id === newRoute);
    if (!module?.enabled) {
      setMessage('Enable the destination module before creating an alias.');
      return;
    }
    let id = `alias-${newRoute}-${Date.now()}`;
    let suffix = 1;
    while (config.navigation.some((item) => item.id === id)) {
      id = `alias-${newRoute}-${Date.now()}-${suffix++}`;
    }
    const alias: NavigationPreference = {
      id,
      route: newRoute,
      label: label.slice(0, 80),
      labelAr: draftLabelAr.trim().slice(0, 80) || label.slice(0, 80),
      group: draftGroup.trim().slice(0, 40) || 'CUSTOM',
      visible: true,
      order: Math.max(-1, ...config.navigation.map((item) => item.order)) + 1
    };
    commit(
      { ...config, navigation: [...config.navigation, alias] },
      'ADD_NAVIGATION_ALIAS',
      newRoute,
      `Added menu alias “${alias.label}” for existing route “${newRoute}”.`
    );
    setDraftLabel('');
    setDraftLabelAr('');
  };

  const removeAlias = (item: NavigationPreference) => {
    if (!canManage || item.id === item.route) return;
    if (!window.confirm(`Remove the menu alias “${item.label}”? The destination and its records will remain unchanged.`)) return;
    commit(
      { ...config, navigation: config.navigation.filter((entry) => entry.id !== item.id) },
      'REMOVE_NAVIGATION_ALIAS',
      item.id,
      `Removed menu alias “${item.label}”; destination records were retained.`
    );
  };

  return (
    <section className="surface-card customization-center" aria-labelledby="customization-title">
      <header className="card-head">
        <div>
          <span className="eyebrow">APPLICATION PRESENTATION / LOCAL PREFERENCES</span>
          <h2 id="customization-title">Customization center</h2>
        </div>
        <button className="btn-secondary" type="button" onClick={restore} disabled={!canManage}>Restore defaults</button>
      </header>
      <p className="muted-text">
        Configure visible modules, bilingual menu labels/order and dashboard widgets. Changes are stored locally on this device.
        Hiding a screen does not delete records. These settings are not authentication or server-enforced access control.
      </p>
      {!canManage && <p className="notice-inline" role="note">Management is disabled for this local role preview; this is not a security boundary.</p>}

      <div className="choice-row" role="tablist" aria-label="Customization areas">
        {(['modules', 'navigation', 'dashboard'] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? 'selected' : ''} onClick={() => setTab(item)}>
            {item === 'modules' ? 'Modules' : item === 'navigation' ? 'Navigation' : 'Dashboard widgets'}
          </button>
        ))}
      </div>

      {tab === 'modules' && (
        <div className="customization-list">
          {config.modules.map((module) => (
            <article key={module.id} className="customization-row">
              <div className="customization-copy">
                <strong>{module.label}</strong><small>{module.description}</small><code>{module.id}</code>
              </div>
              <label className="setting-toggle">
                <span><strong>Enabled</strong></span>
                <input
                  aria-label={`Enable ${module.label}`}
                  type="checkbox"
                  checked={module.enabled}
                  disabled={!canManage || PROTECTED_ROUTES.includes(module.id)}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    commit({
                      ...config,
                      modules: config.modules.map((item) => item.id === module.id ? { ...item, enabled } : item),
                      navigation: config.navigation.map((item) => item.route === module.id ? { ...item, visible: enabled } : item)
                    }, enabled ? 'ENABLE_MODULE' : 'DISABLE_MODULE', module.id, `Module ${enabled ? 'enabled' : 'disabled'} locally.`);
                  }}
                />
              </label>
              <label className="custom-role">
                <span>Hide from role (local preview)</span>
                <select
                  aria-label={`Role visibility ${module.label}`}
                  value={module.hiddenForRoles[0] || ''}
                  disabled={!canManage || PROTECTED_ROUTES.includes(module.id)}
                  onChange={(event) => commit({
                    ...config,
                    modules: config.modules.map((item) => item.id === module.id
                      ? { ...item, hiddenForRoles: event.target.value ? [event.target.value as Role] : [] }
                      : item)
                  }, 'CHANGE_LOCAL_ROLE_VISIBILITY', module.id, `Changed local presentation visibility for ${event.target.value || 'all roles'}.`)}
                >
                  <option value="">All roles</option>
                  {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>
            </article>
          ))}
        </div>
      )}

      {tab === 'navigation' && (
        <>
          <div className="customization-list">
            {config.navigation.map((item, index) => (
              <article key={item.id} className="customization-row">
                <div className="customization-copy">
                  <strong>{item.label}</strong><small>{item.group} · destination: {item.route}</small><code>{item.id}</code>
                </div>
                <label className="custom-role">
                  <span>English label</span>
                  <input
                    aria-label={`English label ${item.id}`}
                    disabled={!canManage}
                    value={item.label}
                    maxLength={80}
                    onChange={(event) => setConfig((current) => ({
                      ...current,
                      navigation: current.navigation.map((entry) => entry.id === item.id ? { ...entry, label: event.target.value } : entry)
                    }))}
                    onBlur={(event) => saveNavigationField(item.id, 'label', event.currentTarget.value)}
                  />
                </label>
                <label className="custom-role">
                  <span>Arabic label</span>
                  <input
                    aria-label={`Arabic label ${item.id}`}
                    disabled={!canManage}
                    value={item.labelAr || ''}
                    maxLength={80}
                    onChange={(event) => setConfig((current) => ({
                      ...current,
                      navigation: current.navigation.map((entry) => entry.id === item.id ? { ...entry, labelAr: event.target.value } : entry)
                    }))}
                    onBlur={(event) => saveNavigationField(item.id, 'labelAr', event.currentTarget.value)}
                  />
                </label>
                <label className="custom-role">
                  <span>Group</span>
                  <input
                    aria-label={`Navigation group ${item.id}`}
                    disabled={!canManage}
                    value={item.group}
                    maxLength={40}
                    onChange={(event) => setConfig((current) => ({
                      ...current,
                      navigation: current.navigation.map((entry) => entry.id === item.id ? { ...entry, group: event.target.value } : entry)
                    }))}
                    onBlur={(event) => saveNavigationField(item.id, 'group', event.currentTarget.value)}
                  />
                </label>
                <label className="setting-toggle">
                  <span><strong>Visible</strong></span>
                  <input
                    aria-label={`Show menu ${item.id}`}
                    type="checkbox"
                    checked={item.visible && config.modules.find((module) => module.id === item.route)?.enabled !== false}
                    disabled={!canManage || PROTECTED_ROUTES.includes(item.route)}
                    onChange={(event) => {
                      const visible = event.target.checked;
                      commit({
                        ...config,
                        navigation: config.navigation.map((entry) => entry.id === item.id ? { ...entry, visible } : entry)
                      }, visible ? 'SHOW_NAVIGATION_ENTRY' : 'HIDE_NAVIGATION_ENTRY', item.id, 'Changed local navigation visibility; destination data is retained.');
                    }}
                  />
                </label>
                <div className="custom-order">
                  <button type="button" className="btn-secondary" aria-label={`Move ${item.id} up`} disabled={!canManage || index === 0} onClick={() => commit({ ...config, navigation: reorder(config.navigation, index, -1) }, 'REORDER_NAVIGATION', item.id, 'Moved navigation entry up.')}>↑</button>
                  <button type="button" className="btn-secondary" aria-label={`Move ${item.id} down`} disabled={!canManage || index === config.navigation.length - 1} onClick={() => commit({ ...config, navigation: reorder(config.navigation, index, 1) }, 'REORDER_NAVIGATION', item.id, 'Moved navigation entry down.')}>↓</button>
                  {item.id !== item.route && <button type="button" className="btn-danger" aria-label={`Remove alias ${item.id}`} disabled={!canManage} onClick={() => removeAlias(item)}>×</button>}
                </div>
              </article>
            ))}
          </div>
          <div className="customization-add">
            <label>English menu label<input aria-label="New menu label" value={draftLabel} onChange={(event) => setDraftLabel(event.target.value)} maxLength={80} /></label>
            <label>Arabic menu label<input aria-label="New Arabic menu label" value={draftLabelAr} onChange={(event) => setDraftLabelAr(event.target.value)} maxLength={80} /></label>
            <label>Existing destination
              <select aria-label="Existing destination" value={newRoute} onChange={(event) => setNewRoute(event.target.value as CustomizableRoute)}>
                {destinationOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <label>Group<input aria-label="Navigation group" value={draftGroup} onChange={(event) => setDraftGroup(event.target.value)} maxLength={40} /></label>
            <button type="button" className="btn-primary" disabled={!canManage} onClick={addAlias}>Add menu alias</button>
            <small>Aliases reuse a supported application destination; they cannot create arbitrary routes or machine actions.</small>
          </div>
        </>
      )}

      {tab === 'dashboard' && (
        <div className="customization-list">
          {config.dashboard.map((widget, index) => (
            <article key={widget.id} className="customization-row">
              <div className="customization-copy"><strong>{widget.label}</strong><small>Widget: {widget.id}</small></div>
              <label className="setting-toggle">
                <span><strong>Visible</strong></span>
                <input
                  aria-label={`Show widget ${widget.label}`}
                  type="checkbox"
                  checked={widget.visible}
                  disabled={!canManage}
                  onChange={(event) => commit({
                    ...config,
                    dashboard: config.dashboard.map((item) => item.id === widget.id ? { ...item, visible: event.target.checked } : item)
                  }, event.target.checked ? 'SHOW_WIDGET' : 'HIDE_WIDGET', widget.id, 'Changed local dashboard widget visibility.')}
                />
              </label>
              <label className="custom-role">
                <span>Size</span>
                <select aria-label={`Widget size ${widget.label}`} value={widget.size} disabled={!canManage} onChange={(event) => commit({
                  ...config,
                  dashboard: config.dashboard.map((item) => item.id === widget.id ? { ...item, size: event.target.value as 'compact' | 'wide' } : item)
                }, 'RESIZE_WIDGET', widget.id, `Set widget size to ${event.target.value}.`)}>
                  <option value="compact">Compact</option><option value="wide">Wide</option>
                </select>
              </label>
              <div className="custom-order">
                <button type="button" className="btn-secondary" aria-label={`Move widget ${widget.label} up`} disabled={!canManage || index === 0} onClick={() => commit({ ...config, dashboard: reorder(config.dashboard, index, -1) }, 'REORDER_WIDGET', widget.id, 'Moved dashboard widget up.')}>↑</button>
                <button type="button" className="btn-secondary" aria-label={`Move widget ${widget.label} down`} disabled={!canManage || index === config.dashboard.length - 1} onClick={() => commit({ ...config, dashboard: reorder(config.dashboard, index, 1) }, 'REORDER_WIDGET', widget.id, 'Moved dashboard widget down.')}>↓</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {message && <p role="status" className="customization-message">{message}</p>}
      <details className="customization-audit">
        <summary>Local customization audit ({audit.length})</summary>
        {audit.length === 0
          ? <p className="muted-text">No customization actions recorded.</p>
          : <ol>{audit.slice(0, 30).map((entry) => (
              <li key={entry.id}><time>{entry.timestamp}</time> · <strong>{entry.action}</strong> · {entry.target} — {entry.detail}</li>
            ))}</ol>}
        <p className="muted-text">This audit log is local-device data and can be changed or removed by anyone with access to this browser/device.</p>
      </details>
    </section>
  );
}
