import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('renders a status role', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('applies the requested size class', () => {
    render(<Spinner size="lg" />);
    expect(screen.getByRole('status').className).toMatch(/h-10/);
  });
});
