import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const getMock = vi.fn();
vi.mock('services/apiClient', () => ({
  default: { get: (...args: unknown[]) => getMock(...args) },
}));

import { SearchBox } from './SearchBox';

describe('SearchBox', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('does not search when the input is empty', () => {
    render(<SearchBox />);
    expect(getMock).not.toHaveBeenCalled();
  });

  it('searches and renders matching movies', async () => {
    getMock.mockResolvedValue({
      data: [
        { id: 1, name: 'Matrix Reloaded', avatar: 'a.jpg' },
        { id: 2, name: 'Inception', avatar: 'b.jpg' },
      ],
    });
    render(<SearchBox />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'matrix' } });

    await waitFor(() => {
      expect(screen.getByText('Matrix Reloaded')).toBeInTheDocument();
    });
    expect(screen.queryByText('Inception')).not.toBeInTheDocument();
  });

  it('clears results when the search is cleared', async () => {
    getMock.mockResolvedValue({ data: [{ id: 1, name: 'Matrix', avatar: '' }] });
    render(<SearchBox />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'matrix' } });
    await waitFor(() => expect(screen.getByText('Matrix')).toBeInTheDocument());

    fireEvent.change(input, { target: { value: '' } });
    await waitFor(() => expect(screen.queryByText('Matrix')).not.toBeInTheDocument());
  });
});
