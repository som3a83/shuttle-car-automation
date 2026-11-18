import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../mockData';

describe('first-run locale defaults', () => {
  it('starts new installations in Arabic without overriding an explicitly saved preference', () => {
    expect(defaultSettings.language).toBe('ar');
  });
});
