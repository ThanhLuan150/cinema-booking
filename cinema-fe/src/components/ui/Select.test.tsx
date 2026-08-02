import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select } from './Select';

const options = [
  { label: 'One', value: '1' },
  { label: 'Two', value: '2' },
];

describe('Select', () => {
  it('renders the placeholder when no value is selected', () => {
    render(<Select options={options} placeholder="Choose one" />);
    expect(screen.getByRole('button')).toHaveTextContent('Choose one');
  });

  it('shows the label for the selected value', () => {
    render(<Select options={options} value="2" />);
    expect(screen.getByRole('button')).toHaveTextContent('Two');
  });

  it('opens the option list on click and calls onChange when selecting', () => {
    const onChange = vi.fn();
    render(<Select options={options} onChange={onChange} name="field" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Two'));
    expect(onChange).toHaveBeenCalledWith({ target: { name: 'field', value: '2' } });
  });

  it('closes the list on Escape and calls onBlur', () => {
    const onBlur = vi.fn();
    render(<Select options={options} onBlur={onBlur} name="field" />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onBlur).toHaveBeenCalledWith({ target: { name: 'field' } });
  });

  it('shows an error message', () => {
    render(<Select options={options} error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });
});
