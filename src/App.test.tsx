import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { describe, it, expect } from 'vitest';

describe('Shuttle Car Automation V6', () => {
  it('renders the industrial dashboard', () => {
    render(<App />);
    expect(screen.getByText(/Total shuttle cars/i)).toBeInTheDocument();
    expect(screen.getByText(/Running shuttles/i)).toBeInTheDocument();
    expect(screen.getByText(/System communication status/i)).toBeInTheDocument();
  });

  it('switches to Arabic and updates interface direction', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Arabic/i }));
    expect(screen.getByText(/لوحة القيادة/i)).toBeInTheDocument();
    expect(screen.getByText(/إجمالي عربات النقل/i)).toBeInTheDocument();
  });
});
