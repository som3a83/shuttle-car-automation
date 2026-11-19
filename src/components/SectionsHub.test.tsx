import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SectionsHub, { type SectionsHubItem } from './SectionsHub';

const items: SectionsHubItem[] = [
  { id: 'fleet', menuId: 'fleet-menu', icon: 'truck', en: 'Fleet Control Center', ar: 'إدارة الأسطول', group: 'OPERATIONS' },
  { id: 'connections', menuId: 'connections-menu', icon: 'network', en: 'Device Connections', ar: 'اتصالات المعدات', group: 'SYSTEM' }
];

describe('SectionsHub', () => {
  it('renders one actionable card per visible section and opens the selected route', () => {
    const onOpen = vi.fn();
    render(<SectionsHub items={items} language="en" activeId="hub" onOpen={onOpen} renderIcon={name => <span>{name}</span>} />);
    const region = screen.getByRole('region', { name: 'All sections' });
    const buttons = within(region).getAllByRole('button');
    expect(buttons).toHaveLength(2);
    fireEvent.click(within(region).getByRole('button', { name: /Device Connections/ }));
    expect(onOpen).toHaveBeenCalledWith('connections');
  });

  it('renders Arabic group, section and open labels in RTL language mode', () => {
    render(<SectionsHub items={items} language="ar" activeId="hub" onOpen={vi.fn()} renderIcon={name => <span>{name}</span>} />);
    const region = screen.getByRole('region', { name: 'كل الأقسام' });
    expect(within(region).getByRole('heading', { name: 'كل الأقسام' })).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: /اتصالات المعدات/ })).toHaveTextContent('فتح');
    expect(within(region).getByText('النظام')).toBeInTheDocument();
  });
});
