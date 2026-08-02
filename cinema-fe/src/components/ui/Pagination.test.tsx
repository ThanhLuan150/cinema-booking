import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('renders nothing when totalPages <= 1', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onPageChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('disables the previous button on the first page', () => {
    render(<Pagination page={1} totalPages={5} onPageChange={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).not.toBeDisabled();
  });

  it('disables the next button on the last page', () => {
    render(<Pagination page={5} totalPages={5} onPageChange={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).not.toBeDisabled();
    expect(buttons[1]).toBeDisabled();
  });

  it('calls onPageChange with the adjacent page numbers', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={3} totalPages={5} onPageChange={onPageChange} />);
    const buttons = screen.getAllByRole('button');
    buttons[0].click();
    expect(onPageChange).toHaveBeenCalledWith(2);
    buttons[1].click();
    expect(onPageChange).toHaveBeenCalledWith(4);
  });
});
