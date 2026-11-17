import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import CustomizationLauncher from './CustomizationLauncher';

afterEach(() => { cleanup(); localStorage.clear(); });

describe('customization entry point', () => {
  it('opens and closes the local application customization dialog', () => {
    render(<CustomizationLauncher />);
    fireEvent.click(screen.getByRole('button', { name: /Customize/i }));
    expect(screen.getByRole('dialog', { name: /Application customization/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Customization center/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Close customization/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
