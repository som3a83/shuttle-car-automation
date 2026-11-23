import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App, { hydrateApplicationState, type AppInitialData } from './App';
import StorageRecoveryGate from './components/StorageRecoveryGate';
import './index.css';
import './premium-industrial.css';
import { bootstrapOperationalStorage, type OperationalBootstrapResult } from './security/operationalStorage';
import { getStorageModePreference } from './storage';

let bootstrapPromise: Promise<OperationalBootstrapResult> | null = null;
let hydrationPromise: Promise<AppInitialData> | null = null;

function loadBootstrapOnce(): Promise<OperationalBootstrapResult> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      // Read-only preference check. Missing/invalid preference defaults to legacy; do not write it here.
      getStorageModePreference();
      return bootstrapOperationalStorage();
    })();
  }
  return bootstrapPromise;
}

function loadHydrationOnce(): Promise<AppInitialData> {
  if (!hydrationPromise) hydrationPromise = hydrateApplicationState();
  return hydrationPromise;
}

export function ApplicationBootstrap() {
  const [bootstrap, setBootstrap] = useState<OperationalBootstrapResult | null>(null);
  const [initialData, setInitialData] = useState<AppInitialData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void loadBootstrapOnce().then((result) => {
      if (active) setBootstrap(result);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Operational storage inspection failed.');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!bootstrap || bootstrap.status !== 'ready') return;
    let active = true;
    void loadHydrationOnce().then((result) => {
      if (active) setInitialData(result);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Application data hydration failed.');
    });
    return () => { active = false; };
  }, [bootstrap]);

  if (error) return <main className="storage-recovery-shell" dir="auto">
    <section className="surface-card storage-recovery-header">
      <span className="eyebrow">STARTUP SAFETY / STORAGE VALIDATION</span>
      <h1>Application startup paused</h1>
      <p>Startup validation or data hydration could not be completed. The application remains unavailable.</p>
      <div className="security-error" role="alert">{error}</div>
      <button type="button" className="btn-secondary" onClick={() => window.location.reload()}>Retry inspection</button>
    </section>
  </main>;

  if (!bootstrap) return <main className="storage-recovery-shell" dir="auto">
    <section className="surface-card storage-recovery-header">
      <span className="eyebrow">STARTUP SAFETY / STORAGE VALIDATION</span>
      <h1>Checking operational records…</h1>
      <p>Waiting for storage validation to finish before loading application state.</p>
    </section>
  </main>;

  if (bootstrap.status === 'recovery-required') {
    return <StorageRecoveryGate
      initial={bootstrap}
      onRecovered={() => setBootstrap({ status: 'ready', issues: [] })}
    />;
  }

  if (!initialData) return <main className="storage-recovery-shell" dir="auto">
    <section className="surface-card storage-recovery-header">
      <span className="eyebrow">STARTUP SAFETY / APPLICATION HYDRATION</span>
      <h1>Loading application data…</h1>
      <p>Operational records, authentication, audit integrity and customization are being loaded.</p>
    </section>
  </main>;

  return <App initialData={initialData} />;
}

const root = document.getElementById('root');
if (!root) throw new Error('Application root element was not found.');
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ApplicationBootstrap />
  </React.StrictMode>
);
