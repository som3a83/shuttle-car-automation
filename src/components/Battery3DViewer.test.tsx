import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Battery3DViewer from './Battery3DViewer';
import { initialBatteries } from '../data/mockData';

describe('Battery3DViewer WebGL fallback', () => {
  it('shows the existing battery illustration when WebGL is unavailable', async () => {
    const battery = initialBatteries[0];
    render(
      <Battery3DViewer
        battery={battery}
        fallback={<div data-testid="battery-schematic-fallback">Battery schematic fallback</div>}
      />
    );

    expect(await screen.findByTestId('battery-schematic-fallback')).toBeInTheDocument();
    expect(screen.getByText('LITHIUM PACK · CONCEPTUAL INTERNAL ASSEMBLY')).toBeInTheDocument();
    expect(screen.getByText(battery.id)).toBeInTheDocument();
    expect(screen.getByText('ORTHOGRAPHIC / INTERNAL REFERENCE GEOMETRY')).toBeInTheDocument();
    expect(screen.getByText('REF 680 × 370 mm · L × W')).toBeInTheDocument();
  });
});

describe('Battery3DViewer interactive engineering controls', () => {
  it('keeps the engineering controls outside the fixed-height 3D viewport', () => {
    const { container } = render(
      <Battery3DViewer
        battery={initialBatteries[0]}
        language="en"
        fallback={<div data-testid="battery-schematic-fallback">Battery schematic fallback</div>}
      />
    );

    const shell = container.querySelector<HTMLElement>('.battery-3d-shell');
    const controls = container.querySelector<HTMLElement>('.battery-engineering-controls');
    const stage = container.querySelector<HTMLElement>('.battery-3d-stage');
    const host = container.querySelector<HTMLElement>('.battery-3d-host');

    expect(shell).toContainElement(controls);
    expect(stage).toContainElement(host);
    expect(stage).not.toContainElement(controls);
    expect(stage).toHaveClass('battery-3d-stage');
  });

  it('changes orthographic view, exploded state and selected battery assembly', async () => {
    const battery = initialBatteries[0];
    render(
      <Battery3DViewer
        battery={battery}
        language="en"
        fallback={<div data-testid="battery-schematic-fallback">Battery schematic fallback</div>}
      />
    );

    const topView = screen.getByRole('button', { name: 'Top view' });
    fireEvent.click(topView);
    expect(topView).toHaveAttribute('aria-pressed', 'true');

    const explode = screen.getByRole('button', { name: 'Exploded assembly' });
    fireEvent.click(explode);
    expect(explode).toHaveAttribute('aria-pressed', 'true');

    const cells = screen.getByRole('button', { name: 'Cell bank' });
    fireEvent.click(cells);
    expect(cells).toHaveAttribute('aria-pressed', 'true');
  });

  it('restores the default isometric arrangement with the reset control', async () => {
    render(
      <Battery3DViewer
        battery={initialBatteries[0]}
        language="en"
        fallback={<div>Battery schematic fallback</div>}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Top view' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exploded assembly' }));

    expect(screen.getByRole('button', { name: 'Reassemble' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Reset battery view' }));

    expect(screen.getByRole('button', { name: 'Isometric view' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Exploded assembly' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Battery enclosure' })).toHaveAttribute('aria-pressed', 'true');
  });
});
