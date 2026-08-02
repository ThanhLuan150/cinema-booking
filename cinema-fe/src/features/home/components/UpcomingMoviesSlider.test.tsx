import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const useMoviesMock = vi.fn();
vi.mock('@/features/movies/hooks/useMovies', () => ({ useMovies: () => useMoviesMock() }));

import Upcoming from './UpcomingMoviesSlider';

describe('UpcomingMoviesSlider', () => {
  beforeEach(() => useMoviesMock.mockReset());

  it('shows an empty state when there are no upcoming movies', () => {
    useMoviesMock.mockReturnValue({
      data: { data: [{ id: 1, name: 'Released', premiere_date: '2020-01-01', avatar: '', categories: [] }] },
    });
    render(<Upcoming />);
    expect(screen.getByText('empty')).toBeInTheDocument();
  });

  it('renders not-yet-released movies', () => {
    useMoviesMock.mockReturnValue({
      data: { data: [{ id: 1, name: 'Coming Soon', premiere_date: '2099-01-01', avatar: '', categories: [] }] },
    });
    render(<Upcoming />);
    expect(screen.getByText('Coming Soon')).toBeInTheDocument();
  });
});
