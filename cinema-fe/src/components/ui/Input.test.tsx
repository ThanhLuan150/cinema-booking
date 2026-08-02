import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  it('renders a label associated with the input', () => {
    render(<Input id="email" label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('shows an error message and error styling', () => {
    render(<Input id="email" label="Email" error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByLabelText('Email').className).toMatch(/red/);
  });

  it('calls onChange when typed into', () => {
    const onChange = vi.fn();
    render(<Input id="name" label="Name" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alice' } });
    expect(onChange).toHaveBeenCalled();
  });
});
