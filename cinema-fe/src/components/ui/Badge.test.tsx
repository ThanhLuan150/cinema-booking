import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('applies the success variant class', () => {
    render(<Badge variant="success">Active</Badge>);
    expect(screen.getByText('Active').className).toMatch(/emerald/);
  });
});
