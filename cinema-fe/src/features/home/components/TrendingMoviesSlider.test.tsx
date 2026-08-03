import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const useMoviesMock = vi.fn();
vi.mock('@/features/movies/hooks/useMovies', () => ({ useMovies: () => useMoviesMock() }));

import Trending from './TrendingMoviesSlider';

describe('TrendingMoviesSlider', () => {
  beforeEach(() => useMoviesMock.mockReset());

  it('shows an empty state when there are no already-released movies', () => {
    useMoviesMock.mockReturnValue({
      data: { data: [{ id: 1, name: 'Future', premiere_date: '2099-01-01', avatar: '', categories: [] }] },
    });
    render(
      <MemoryRouter>
        <Trending />
      </MemoryRouter>,
    );
    expect(screen.getByText('empty')).toBeInTheDocument();
  });

  it('renders already-released movies', () => {
    useMoviesMock.mockReturnValue({
      data: { data: [{ id: 1, name: 'Released', premiere_date: '2020-01-01', avatar: '', categories: [] }] },
    });
    render(
      <MemoryRouter>
        <Trending />
      </MemoryRouter>,
    );
    expect(screen.getByText('Released')).toBeInTheDocument();
  });
});
