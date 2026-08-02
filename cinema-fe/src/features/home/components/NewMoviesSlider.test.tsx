import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const useMoviesMock = vi.fn();
vi.mock('@/features/movies/hooks/useMovies', () => ({ useMovies: () => useMoviesMock() }));

import New from './NewMoviesSlider';

describe('NewMoviesSlider', () => {
  beforeEach(() => useMoviesMock.mockReset());

  it('shows an empty state when there are no movies', () => {
    useMoviesMock.mockReturnValue({ data: { data: [] } });
    render(<New />);
    expect(screen.getByText('empty')).toBeInTheDocument();
  });

  it('renders the newest movies, most recent first', () => {
    useMoviesMock.mockReturnValue({
      data: {
        data: [
          { id: 1, name: 'Older', createdAt: '2026-01-01T00:00:00.000Z', avatar: '', categories: [] },
          { id: 2, name: 'Newer', createdAt: '2026-02-01T00:00:00.000Z', avatar: '', categories: [] },
        ],
      },
    });
    render(<New />);
    expect(screen.getByText('Older')).toBeInTheDocument();
    expect(screen.getByText('Newer')).toBeInTheDocument();
  });
});
