import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import CustomizationCenter from './CustomizationCenter';
import {
  CUSTOMIZATION_AUDIT_KEY,
  CUSTOMIZATION_STORAGE_KEY,
  DEFAULT_CUSTOMIZATION,
  validateCustomization
} from '../data/applicationCustomization';

beforeEach(() => {
  cleanup();
  localStorage.clear();
});

async function renderReady(canManage = true) {
  render(<CustomizationCenter canManage={canManage} />);
  await screen.findByRole('button', { name: 'Restore defaults' });
}

describe('local application customization center', () => {
  it('disables a non-critical module and records the local change', async () => {
    await renderReady(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable Battery Management' }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(CUSTOMIZATION_STORAGE_KEY) || '{}').modules.find((item: { id: string }) => item.id === 'batteries').enabled).toBe(false));
    const saved = JSON.parse(localStorage.getItem(CUSTOMIZATION_STORAGE_KEY) || '{}');
    expect(saved.modules.find((item: { id: string }) => item.id === 'batteries').enabled).toBe(false);
    expect(JSON.parse(localStorage.getItem(CUSTOMIZATION_AUDIT_KEY) || '[]')[0].action).toBe('DISABLE_MODULE');
  });

  it('protects core modules and describes the local-only boundary', async () => {
    await renderReady(false);
    expect(screen.getByRole('checkbox', { name: 'Enable Dashboard' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Restore defaults' })).toBeDisabled();
    expect(screen.getByText(/not authentication or server-enforced access control/i)).toBeInTheDocument();
  });

  it('applies dashboard visibility and order preferences', async () => {
    await renderReady(true);
    fireEvent.click(screen.getByRole('tab', { name: 'Dashboard widgets' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show widget Battery overview' }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(CUSTOMIZATION_STORAGE_KEY) || '{}').dashboard.find((item: { id: string }) => item.id === 'battery-status').visible).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Move widget Open fault records up' }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(CUSTOMIZATION_STORAGE_KEY) || '{}').dashboard[1].id).toBe('faults'));
  });

  it('recovers malformed preferences and retains protected routes', () => {
    const parsed = validateCustomization({
      modules: [{ id: 'dashboard', enabled: false, hiddenForRoles: ['Viewer'] }],
      navigation: [{ id: 'dashboard', route: 'dashboard', visible: false, order: 0 }],
      dashboard: []
    });
    expect(parsed.modules.find((item) => item.id === 'dashboard')).toMatchObject({ enabled: true, hiddenForRoles: [] });
    expect(parsed.navigation.find((item) => item.route === 'dashboard')?.visible).toBe(true);
    expect(parsed.navigation).toHaveLength(DEFAULT_CUSTOMIZATION.navigation.length);
  });

  it('drops unknown route aliases and ignores malformed preference entries', () => {
    const parsed = validateCustomization({
      navigation: [
        { id: 'alias-good', route: 'fleet', label: 'Fleet shortcut', visible: true },
        { id: 'alias-bad', route: 'does-not-exist', label: 'Broken link', visible: true }
      ]
    });
    expect(parsed.navigation.some((item) => item.id === 'alias-good')).toBe(true);
    expect(parsed.navigation.some((item) => item.id === 'alias-bad')).toBe(false);
  });
  it('preserves an individual hidden menu entry when its module is disabled and re-enabled', async () => {
    const preferences = JSON.parse(JSON.stringify(DEFAULT_CUSTOMIZATION)) as typeof DEFAULT_CUSTOMIZATION;
    const shiftEntry = preferences.navigation.find((item) => item.route === 'shifts');
    if (!shiftEntry) throw new Error('Default shift navigation entry is missing.');
    shiftEntry.visible = false;
    localStorage.setItem(CUSTOMIZATION_STORAGE_KEY, JSON.stringify(preferences));

    await renderReady(true);
    const toggle = screen.getByRole('checkbox', { name: 'Enable Shift Operations & Handover' });
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).not.toBeChecked());
    await waitFor(() => expect(JSON.parse(localStorage.getItem(CUSTOMIZATION_STORAGE_KEY) || '{}').modules.find((item: { id: string }) => item.id === 'batteries').enabled).toBe(false));
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toBeChecked());
    await waitFor(() => expect(JSON.parse(localStorage.getItem(CUSTOMIZATION_STORAGE_KEY) || '{}').modules.find((item: { id: string }) => item.id === 'batteries').enabled).toBe(true));
    const saved = JSON.parse(localStorage.getItem(CUSTOMIZATION_STORAGE_KEY) || '{}');
    expect(saved.modules.find((item: { id: string }) => item.id === 'batteries').enabled).toBe(true);
    expect(saved.navigation.find((item: { id: string }) => item.id === 'batteries').visible).toBe(false);
  });

});
