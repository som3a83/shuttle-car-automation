import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import CustomizationLauncher from './components/CustomizationLauncher';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <CustomizationLauncher />
  </React.StrictMode>
);
