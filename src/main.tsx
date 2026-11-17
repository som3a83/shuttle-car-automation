import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import CustomizationLauncher from './components/CustomizationLauncher';
import StorageRecoveryGate from './components/StorageRecoveryGate';
import './index.css';
import { bootstrapOperationalStorage, type OperationalBootstrapResult } from './security/operationalStorage';

function ApplicationBootstrap() {
  const [bootstrap, setBootstrap] = useState<OperationalBootstrapResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void bootstrapOperationalStorage().then((result) => {
      if (active) setBootstrap(result);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Operational storage inspection failed.');
    });
    return () => { active = false; };
  }, []);

  if (error) return <main className="storage-recovery-shell" dir="auto">
    <section className="surface-card storage-recovery-header">
      <span className="eyebrow">STARTUP SAFETY / STORAGE VALIDATION</span>
      <h1>Application startup paused</h1>
      <p>The application did not write operational data because storage inspection failed.</p>
      <div className="security-error" role="alert">{error}</div>
      <button type="button" className="btn-secondary" onClick={() => window.location.reload()}>Retry inspection</button>
    </section>
  </main>;

  if (!bootstrap) return <main className="storage-recovery-shell" dir="auto">
    <section className="surface-card storage-recovery-header">
      <span className="eyebrow">STARTUP SAFETY / STORAGE VALIDATION</span>
      <h1>Checking operational records…</h1>
      <p>No application data will be changed during inspection.</p>
    </section>
  </main>;

  if (bootstrap.status === 'recovery-required') {
    return <StorageRecoveryGate
      initial={bootstrap}
      onRecovered={() => setBootstrap({ status: 'ready', issues: [] })}
    />;
  }

  return <>
    <App />
    <CustomizationLauncher />
  </>;
}

const root = document.getElementById('root');
if (!root) throw new Error('Application root element was not found.');
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ApplicationBootstrap />
  </React.StrictMode>
);
