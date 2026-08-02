import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Alert } from './Alert';

describe('Alert', () => {
  it('renders children with an alert role', () => {
    render(<Alert>Something happened</Alert>);
    expect(screen.getByRole('alert')).toHaveTextContent('Something happened');
  });

  it('defaults to the info variant class', () => {
    render(<Alert>Info</Alert>);
    expect(screen.getByRole('alert').className).toMatch(/blue/);
  });

  it('applies the error variant class', () => {
    render(<Alert variant="error">Error</Alert>);
    expect(screen.getByRole('alert').className).toMatch(/red/);
  });
});
