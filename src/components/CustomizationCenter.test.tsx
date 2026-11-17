import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import CustomizationCenter from './CustomizationCenter';
import { CUSTOMIZATION_AUDIT_KEY, CUSTOMIZATION_STORAGE_KEY, DEFAULT_CUSTOMIZATION, validateCustomization } from '../data/applicationCustomization';

beforeEach(() => { cleanup(); localStorage.clear(); });

describe('local application customization center', () => {
  it('lets an administrator hide a non-critical module and records the local change', () => {
    render(<CustomizationCenter canManage />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable AI Technical Assistant' }));
    const saved = JSON.parse(localStorage.getItem(CUSTOMIZATION_STORAGE_KEY) || '{}');
    expect(saved.modules.find((item: {id:string}) => item.id==='ai').enabled).toBe(false);
    expect(JSON.parse(localStorage.getItem(CUSTOMIZATION_AUDIT_KEY) || '[]')[0].action).toBe('DISABLE_MODULE');
  });

  it('protects core modules and disables editing for a read-only role preview', () => {
    render(<CustomizationCenter canManage={false} />);
    expect(screen.getByRole('checkbox', { name: 'Enable Dashboard' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Restore defaults' })).toBeDisabled();
    expect(screen.getByRole('note')).toHaveTextContent(/not server-enforced authorization/i);
  });

  it('supports visible dashboard preferences and reorder controls', () => {
    render(<CustomizationCenter canManage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Dashboard widgets' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show widget Battery overview' }));
    expect(JSON.parse(localStorage.getItem(CUSTOMIZATION_STORAGE_KEY) || '{}').dashboard.find((item: {id:string})=>item.id==='battery-status').visible).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Move widget Open fault records up' }));
    expect(JSON.parse(localStorage.getItem(CUSTOMIZATION_STORAGE_KEY) || '{}').dashboard[1].id).toBe('faults');
  });

  it('only adds aliases for known enabled destinations', () => {
    render(<CustomizationCenter canManage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Navigation' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New menu label' }), { target: { value: 'Service reports' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Existing destination' }), { target: { value: 'reports' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add menu alias' }));
    expect(screen.getByText('Choose an enabled route that is not already in the menu.')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Existing destination' }), { target: { value: 'ai' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add menu alias' }));
    expect(JSON.parse(localStorage.getItem(CUSTOMIZATION_STORAGE_KEY) || '{}').navigation.some((item: {label:string;route:string})=>item.label==='Service reports'&&item.route==='ai')).toBe(true);
  });

  it('recovers malformed preference input while preserving protected defaults', () => {
    const parsed = validateCustomization({ modules: [{ id:'dashboard', enabled:false, label:' ' }], navigation:[], dashboard:[] });
    expect(parsed.modules.find((item)=>item.id==='dashboard')).toMatchObject({ enabled:true, label:'Dashboard' });
    expect(parsed.navigation).toHaveLength(DEFAULT_CUSTOMIZATION.navigation.length);
  });
});
