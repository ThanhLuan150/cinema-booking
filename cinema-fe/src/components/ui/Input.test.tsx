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

  it('does not render a show/hide toggle for a non-password input', () => {
    render(<Input id="email" label="Email" type="email" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('toggles a password field between hidden and visible', () => {
    render(<Input id="pwd" label="Password" type="password" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });
});
