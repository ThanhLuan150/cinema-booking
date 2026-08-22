import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimeInput } from './TimeInput';

describe('TimeInput', () => {
  it('renders a label associated with the trigger button', () => {
    render(<TimeInput id="start" label="Start time" />);
    expect(screen.getByLabelText('Start time')).toBeInTheDocument();
  });

  it('shows a placeholder when no value is set', () => {
    render(<TimeInput id="start" label="Start time" placeholder="Select a time" />);
    expect(screen.getByText('Select a time')).toBeInTheDocument();
  });

  it('displays the selected value as-is (already HH:mm)', () => {
    render(<TimeInput id="start" label="Start time" value="18:30" />);
    expect(screen.getByText('18:30')).toBeInTheDocument();
  });

  it('shows an error message and error styling', () => {
    render(<TimeInput id="start" label="Start time" error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByLabelText('Start time').className).toMatch(/red/);
  });

  it('opens a time list when clicked, not a native time picker', () => {
    render(<TimeInput id="start" label="Start time" />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Start time'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('lists half-hour increments by default, covering the full day', () => {
    render(<TimeInput id="start" label="Start time" />);
    fireEvent.click(screen.getByLabelText('Start time'));
    expect(screen.getByRole('option', { name: '00:00' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '12:30' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '23:30' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(48);
  });

  it('calls onChange with the picked slot and closes the list', () => {
    const onChange = vi.fn();
    render(<TimeInput id="start" label="Start time" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Start time'));
    fireEvent.click(screen.getByRole('option', { name: '19:00' }));
    expect(onChange).toHaveBeenCalledWith({ target: { name: undefined, value: '19:00' } });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('clears the value via the clear button without opening the list', () => {
    const onChange = vi.fn();
    render(<TimeInput id="start" label="Start time" value="18:30" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Clear time'));
    expect(onChange).toHaveBeenCalledWith({ target: { name: undefined, value: '' } });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes the list on outside click', () => {
    render(
      <div>
        <TimeInput id="start" label="Start time" />
        <button type="button">Outside</button>
      </div>,
    );
    fireEvent.click(screen.getByLabelText('Start time'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText('Outside'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does not close on mousedown inside the portaled list itself', () => {
    render(<TimeInput id="start" label="Start time" />);
    fireEvent.click(screen.getByLabelText('Start time'));
    fireEvent.mouseDown(screen.getByRole('option', { name: '09:00' }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('portals the list to document.body instead of nesting it inside a clipping ancestor', () => {
    const { container } = render(
      <div data-testid="clipping-ancestor" style={{ overflow: 'hidden' }}>
        <TimeInput id="start" label="Start time" />
      </div>,
    );
    fireEvent.click(screen.getByLabelText('Start time'));
    const listbox = screen.getByRole('listbox');
    const clippingAncestor = container.querySelector('[data-testid="clipping-ancestor"]');
    expect(clippingAncestor?.contains(listbox)).toBe(false);
    expect(listbox.parentElement).toBe(document.body);
  });

  it('supports a custom step', () => {
    render(<TimeInput id="start" label="Start time" stepMinutes={60} />);
    fireEvent.click(screen.getByLabelText('Start time'));
    expect(screen.getAllByRole('option')).toHaveLength(24);
    expect(screen.getByRole('option', { name: '13:00' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '13:30' })).not.toBeInTheDocument();
  });
});
