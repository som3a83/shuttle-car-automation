import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import Battery3DViewer from './Battery3DViewer';
import { initialBatteries } from '../data/mockData';

describe('Battery3DViewer engineering interactions', () => {
  it('keeps the accessible fallback assembly available when WebGL is unavailable', async () => {
    const battery = initialBatteries[0];
    render(<Battery3DViewer battery={battery} language="en" fallback={<div data-testid="battery-schematic-fallback">Battery schematic fallback</div>} />);

    expect(await screen.findByTestId('battery-schematic-fallback')).toBeInTheDocument();
    expect(screen.getByText(/CONCEPTUAL REFERENCE ASSEMBLY/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(battery.id))).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Battery model view/i })).toBeInTheDocument();
  });

  it('changes orthographic views and toggles exploded assembly', async () => {
    const user = userEvent.setup();
    render(<Battery3DViewer battery={initialBatteries[0]} language="en" fallback={<div>Battery schematic fallback</div>} />);
    await user.click(screen.getByRole('button', { name: /^Top$/i }));
    expect(screen.getByRole('button', { name: /^Top$/i })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: /Exploded assembly/i }));
    expect(screen.getByRole('button', { name: /Reassemble/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('selects battery components and updates the engineering inspector', async () => {
    const user = userEvent.setup();
    render(<Battery3DViewer battery={initialBatteries[0]} language="en" fallback={<div>Battery schematic fallback</div>} />);

    await user.click(screen.getByRole('button', { name: /Battery management system/i }));
    expect(screen.getByRole('heading', { name: /Battery management system/i })).toBeInTheDocument();
    expect(screen.getByText(/No BMS signals or protection states are connected/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Power terminals/i }));
    expect(screen.getByRole('heading', { name: /Power terminals/i })).toBeInTheDocument();
  });

  it('exposes a working model zoom control and reset action', async () => {
    const user = userEvent.setup();
    render(<Battery3DViewer battery={initialBatteries[0]} language="en" fallback={<div>Battery schematic fallback</div>} />);
    const zoom = screen.getByRole('slider', { name: /Model zoom/i });
    fireEvent.change(zoom, { target: { value: '1.35' } });
    expect(zoom).toHaveValue(1.35);
    await user.click(screen.getByRole('button', { name: /Reset view/i }));
    expect(zoom).toHaveValue(1);
  });
});
