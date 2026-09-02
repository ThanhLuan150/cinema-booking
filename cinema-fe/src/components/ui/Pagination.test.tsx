import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { Pagination } from './Pagination';
import { AdminShellContext } from '@/contexts';

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

  describe('inside the admin shell', () => {
    const renderInShell = (footerEl: HTMLElement | null, totalPages = 5) =>
      render(
        <AdminShellContext.Provider value={{ footerEl }}>
          <Pagination page={2} totalPages={totalPages} onPageChange={() => {}} />
        </AdminShellContext.Provider>,
      );

    it('stays in normal flow outside the shell', () => {
      const { container } = render(<Pagination page={2} totalPages={5} onPageChange={() => {}} />);
      const bar = container.firstElementChild!;
      expect(bar.className).toContain('mt-8');
      expect(bar.className).not.toMatch(/border-t/);
    });

    it('portals into the shell footer instead of rendering in place', () => {
      const footer = document.createElement('div');
      document.body.appendChild(footer);
      const { container } = renderInShell(footer);

      // Nothing left behind in the page flow...
      expect(container).toBeEmptyDOMElement();
      // ...it lives in the footer, styled as a bar rather than a spaced block.
      expect(footer.textContent).toContain('pagination.pageInfo');
      expect(footer.firstElementChild!.className).toContain('border-t');
      expect(footer.firstElementChild!.className).not.toContain('mt-8');

      footer.remove();
    });

    it('renders nothing until the footer ref has attached', () => {
      const { container } = renderInShell(null);
      expect(container).toBeEmptyDOMElement();
    });

    it('still renders nothing when there is only one page', () => {
      const footer = document.createElement('div');
      document.body.appendChild(footer);
      const { container } = renderInShell(footer, 1);
      expect(container).toBeEmptyDOMElement();
      expect(footer).toBeEmptyDOMElement();
      footer.remove();
    });
  });
});
