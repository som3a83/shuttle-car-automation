import React from 'react';
import { render, screen } from '@testing-library/react';
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
  });
});
