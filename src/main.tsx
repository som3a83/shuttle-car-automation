import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import CustomizationLauncher from './components/CustomizationLauncher';
import './index.css';
import { bootstrapOperationalStorage } from './security/operationalStorage';

async function startApplication() {
  try { await bootstrapOperationalStorage(); }
  catch (error) { console.error('Operational storage bootstrap failed:', error); }
  const root = document.getElementById('root');
  if (!root) throw new Error('Application root element was not found.');
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
      <CustomizationLauncher />
    </React.StrictMode>
  );
}

void startApplication();
