import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Shuttle3DViewer from './Shuttle3DViewer';

describe('Shuttle3DViewer WebGL fallback', () => {
  it('shows a useful accessible schematic fallback when WebGL is unavailable', async () => {
    render(
      <Shuttle3DViewer
        manufacturer="Cassioli"
        shuttleId="SC-TEST"
        status="Unknown"
        view="iso"
        exploded={false}
        animated={false}
        selectedPart="chassis"
        zoom={1}
        resetKey={0}
        onSelectPart={vi.fn()}
        fallback={<div data-testid="shuttle-schematic-fallback">2D schematic fallback</div>}
      />
    );

    expect(await screen.findByTestId('shuttle-schematic-fallback')).toBeInTheDocument();
    expect(screen.getByText('STATIC ENGINEERING VIEW')).toBeInTheDocument();
    expect(screen.getByText('EQUIPMENT STATE · UNKNOWN')).toBeInTheDocument();
    expect(screen.getByText('ORTHOGRAPHIC / ISO / REF GEOMETRY')).toBeInTheDocument();
    expect(screen.getByText('REF 660 × 310 mm · L × W')).toBeInTheDocument();
  });
});
