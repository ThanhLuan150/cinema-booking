import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('renders a label associated with the textarea', () => {
    render(<Textarea id="bio" label="Bio" />);
    expect(screen.getByLabelText('Bio')).toBeInTheDocument();
  });

  it('shows an error message', () => {
    render(<Textarea id="bio" label="Bio" error="Too long" />);
    expect(screen.getByText('Too long')).toBeInTheDocument();
  });

  it('calls onChange when typed into', () => {
    const onChange = vi.fn();
    render(<Textarea id="bio" label="Bio" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Bio'), { target: { value: 'Hello' } });
    expect(onChange).toHaveBeenCalled();
  });
});
