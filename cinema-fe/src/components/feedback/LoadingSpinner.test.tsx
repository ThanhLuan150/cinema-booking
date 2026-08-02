import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { LoadingSpinner } from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders a default label', () => {
    render(<LoadingSpinner />);
    expect(screen.getByText('actions.loading')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders a custom label', () => {
    render(<LoadingSpinner label="Fetching data" />);
    expect(screen.getByText('Fetching data')).toBeInTheDocument();
  });
});
