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
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable AI Technical Assistant' }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(CUSTOMIZATION_STORAGE_KEY) || '{}').modules.find((item: { id: string }) => item.id === 'ai').enabled).toBe(false));
    const saved = JSON.parse(localStorage.getItem(CUSTOMIZATION_STORAGE_KEY) || '{}');
    expect(saved.modules.find((item: { id: string }) => item.id === 'ai').enabled).toBe(false);
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

  it('creates a removable alias for a destination already in navigation', async () => {
    await renderReady(true);
    fireEvent.click(screen.getByRole('tab', { name: 'Navigation' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New menu label' }), { target: { value: 'Service reports' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'New Arabic menu label' }), { target: { value: 'تقارير الخدمة' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Existing destination' }), { target: { value: 'reports' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add menu alias' }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(CUSTOMIZATION_STORAGE_KEY) || '{}').navigation.some((item: { label: string }) => item.label === 'Service reports')).toBe(true));

    const saved = JSON.parse(localStorage.getItem(CUSTOMIZATION_STORAGE_KEY) || '{}');
    const alias = saved.navigation.find((item: { id: string; label: string; route: string }) => item.label === 'Service reports');
    expect(alias.route).toBe('reports');
    expect(alias.id).not.toBe('reports');
    expect(saved.navigation.some((item: { id: string; labelAr: string }) => item.id === alias.id && item.labelAr === 'تقارير الخدمة')).toBe(true);

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Remove alias ${alias.id}`) }));
    confirmSpy.mockRestore();
    const afterRemoval = JSON.parse(localStorage.getItem(CUSTOMIZATION_STORAGE_KEY) || '{}');
    expect(afterRemoval.navigation.some((item: { id: string }) => item.id === alias.id)).toBe(false);
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
    const aiEntry = preferences.navigation.find((item) => item.route === 'ai');
    if (!aiEntry) throw new Error('Default AI navigation entry is missing.');
    aiEntry.visible = false;
    localStorage.setItem(CUSTOMIZATION_STORAGE_KEY, JSON.stringify(preferences));

    await renderReady(true);
    const toggle = screen.getByRole('checkbox', { name: 'Enable AI Technical Assistant' });
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable AI Technical Assistant' }));

    await waitFor(() => expect(JSON.parse(localStorage.getItem(CUSTOMIZATION_STORAGE_KEY) || '{}').modules.find((item: { id: string }) => item.id === 'ai').enabled).toBe(true));
    const saved = JSON.parse(localStorage.getItem(CUSTOMIZATION_STORAGE_KEY) || '{}');
    expect(saved.modules.find((item: { id: string }) => item.id === 'ai').enabled).toBe(true);
    expect(saved.navigation.find((item: { id: string }) => item.id === 'ai').visible).toBe(false);
  });

});
