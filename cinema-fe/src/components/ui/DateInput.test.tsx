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

  // A full month calendar opened right above a table inevitably overlaps several rows of it;
  // without a dim backdrop that reads as the table having broken, not as a floating panel.
  it('renders a dim backdrop behind the calendar, below its own z-index', () => {
    const { container } = render(<DateInput id="dob" label="Date of birth" />);
    fireEvent.click(screen.getByLabelText('Date of birth'));
    const backdrop = container.ownerDocument.querySelector('[aria-hidden="true"].fixed.inset-0');
    expect(backdrop).toBeInTheDocument();
    expect(backdrop?.className).toMatch(/z-\[59\]/);
    expect(screen.getByRole('dialog').className).toMatch(/z-\[60\]/);
  });

  it('closes the calendar when the backdrop is clicked', () => {
    render(<DateInput id="dob" label="Date of birth" />);
    fireEvent.click(screen.getByLabelText('Date of birth'));
    const backdrop = document.querySelector('[aria-hidden="true"].fixed.inset-0');
    expect(backdrop).toBeInTheDocument();
    fireEvent.mouseDown(backdrop as Element);
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

  // Regression: an ancestor with clipping/scrolling overflow (e.g. a Modal body using
  // overflow-y-auto) must not be able to clip the dropdown or count its overflow into its own
  // scrollable area — both would happen if the dropdown were an `absolute` descendant instead
  // of a portal, and would show up as the surrounding layout getting pushed/reflowed open.
  it('portals the calendar dropdown to document.body instead of nesting it inside a clipping ancestor', () => {
    const { container } = render(
      <div data-testid="clipping-ancestor" style={{ overflow: 'hidden' }}>
        <DateInput id="dob" label="Date of birth" />
      </div>,
    );
    fireEvent.click(screen.getByLabelText('Date of birth'));
    const dialog = screen.getByRole('dialog');
    const clippingAncestor = container.querySelector('[data-testid="clipping-ancestor"]');
    expect(clippingAncestor?.contains(dialog)).toBe(false);
    expect(dialog.parentElement).toBe(document.body);
  });

  it('does not close the calendar on mousedown inside the portaled dropdown itself', () => {
    render(<DateInput id="dob" label="Date of birth" value="2026-01-15" />);
    fireEvent.click(screen.getByLabelText('Date of birth'));
    fireEvent.mouseDown(screen.getByText(/January 2026/i));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  // Regression: a trigger near the bottom of a short viewport, with a calendar tall enough
  // that it wouldn't fit below, must flip to render above the trigger instead of overflowing
  // past the bottom of the screen.
  it('flips the calendar above the trigger when there is not enough room below it', () => {
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const isDropdown = this.getAttribute('role') === 'dialog';
        return {
          top: isDropdown ? 0 : 550,
          bottom: isDropdown ? 300 : 590,
          left: isDropdown ? 0 : 20,
          right: isDropdown ? 280 : 320,
          width: isDropdown ? 280 : 300,
          height: isDropdown ? 300 : 40,
          x: isDropdown ? 0 : 20,
          y: isDropdown ? 0 : 550,
          toJSON() {},
        } as DOMRect;
      });
    const innerHeightSpy = vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600);

    render(<DateInput id="dob" label="Date of birth" />);
    fireEvent.click(screen.getByLabelText('Date of birth'));
    const dialog = screen.getByRole('dialog');
    // Trigger bottom is 590 with only 10px of the 600px-tall viewport left below it, nowhere
    // near enough for a 300px calendar — it should flip to top = triggerTop(550) - height(300) - 4.
    expect(dialog.style.top).toBe('246px');

    rectSpy.mockRestore();
    innerHeightSpy.mockRestore();
  });
});
