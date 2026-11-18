import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ImmersiveWarehouse from './ImmersiveWarehouse';
import { initialShuttles } from '../data/mockData';

describe('ImmersiveWarehouse', () => {
  it('renders the Arabic warehouse controls and clearly labels the scene as illustrative when WebGL is unavailable', async () => {
    vi.stubGlobal('ResizeObserver', undefined);
    Object.defineProperty(window, 'WebGLRenderingContext', { configurable: true, value: undefined });
    render(<ImmersiveWarehouse shuttles={initialShuttles} language="ar" />);

    expect(screen.getByRole('heading', { name: 'المخزن الآلي ثلاثي الأبعاد' })).toBeTruthy();
    expect(screen.getByText(/مشهد توضيحي/)).toBeTruthy();
    expect(await screen.findByText(/تعذر تشغيل الرسوم ثلاثية الأبعاد/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'داخل الممر' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'تشغيل حركة توضيحية' }));
    expect(screen.getByRole('button', { name: 'إيقاف المحاكاة' })).toBeTruthy();
  });
});
