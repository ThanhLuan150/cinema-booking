import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateInput } from './DateInput';

describe('DateInput', () => {
  it('renders a label associated with the trigger button', () => {
    render(<DateInput id="dob" label="Date of birth" />);
    expect(screen.getByLabelText('Date of birth')).toBeInTheDocument();
  });

  it('shows a placeholder when no value is set', () => {
    render(<DateInput id="dob" label="Date of birth" placeholder="Select a date" />);
    expect(screen.getByText('Select a date')).toBeInTheDocument();
  });

  it('displays the selected date formatted, not the raw ISO string', () => {
    render(<DateInput id="dob" label="Date of birth" value="2026-01-15" />);
    expect(screen.getByText('01/15/2026')).toBeInTheDocument();
    expect(screen.queryByText('2026-01-15')).not.toBeInTheDocument();
  });

  it('shows an error message and error styling', () => {
    render(<DateInput id="dob" label="Date of birth" error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByLabelText('Date of birth').className).toMatch(/red/);
  });

  it('opens a calendar dropdown when clicked, not a native date picker', () => {
    render(<DateInput id="dob" label="Date of birth" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Date of birth'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls onChange with an ISO date string when a day is picked', () => {
    const onChange = vi.fn();
    render(<DateInput id="dob" label="Date of birth" value="2026-01-15" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Date of birth'));
    fireEvent.click(screen.getByRole('gridcell', { name: '20' }));
    expect(onChange).toHaveBeenCalledWith({ target: { name: undefined, value: '2026-01-20' } });
  });

  it('closes the calendar after picking a day', () => {
    render(<DateInput id="dob" label="Date of birth" value="2026-01-15" />);
    fireEvent.click(screen.getByLabelText('Date of birth'));
    fireEvent.click(screen.getByRole('gridcell', { name: '20' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('navigates to the next/previous month', () => {
    render(<DateInput id="dob" label="Date of birth" value="2026-01-15" />);
    fireEvent.click(screen.getByLabelText('Date of birth'));
    expect(screen.getByText(/January 2026/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Next month'));
    expect(screen.getByText(/February 2026/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Previous month'));
    fireEvent.click(screen.getByLabelText('Previous month'));
    expect(screen.getByText(/December 2025/i)).toBeInTheDocument();
  });

  it('clears the value via the clear button without opening the calendar', () => {
    const onChange = vi.fn();
    render(<DateInput id="dob" label="Date of birth" value="2026-01-15" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Clear date'));
    expect(onChange).toHaveBeenCalledWith({ target: { name: undefined, value: '' } });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the calendar on outside click', () => {
    render(
      <div>
        <DateInput id="dob" label="Date of birth" />
        <button type="button">Outside</button>
      </div>,
    );
    fireEvent.click(screen.getByLabelText('Date of birth'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText('Outside'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
