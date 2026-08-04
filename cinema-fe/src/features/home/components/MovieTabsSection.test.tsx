import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const useMoviesMock = vi.fn();
vi.mock('@/features/movies/hooks/useMovies', () => ({ useMovies: () => useMoviesMock() }));

import MovieTabs from './MovieTabsSection';

function renderSection() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <MovieTabs />
    </MemoryRouter>,
  );
}

describe('MovieTabsSection', () => {
  beforeEach(() => {
    useMoviesMock.mockReset();
    useMoviesMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            name: 'Released',
            premiere_date: '2020-01-01',
            createdAt: '2020-01-01T00:00:00.000Z',
            avatar: '',
            categories: [],
          },
          {
            id: 2,
            name: 'Future',
            premiere_date: '2099-01-01',
            createdAt: '2026-01-01T00:00:00.000Z',
            avatar: '',
            categories: [],
          },
        ],
      },
    });
  });

  it('shows now-playing movies on the default tab', () => {
    renderSection();
    expect(screen.getByText('Released')).toBeInTheDocument();
    expect(screen.queryByText('Future')).not.toBeInTheDocument();
  });

  it('switches to upcoming movies when that tab is clicked', () => {
    renderSection();
    fireEvent.click(screen.getByRole('tab', { name: 'movieTabs.upcoming' }));
    expect(screen.getByText('Future')).toBeInTheDocument();
    expect(screen.queryByText('Released')).not.toBeInTheDocument();
  });

  it('lists every movie newest-first on the new tab', () => {
    renderSection();
    fireEvent.click(screen.getByRole('tab', { name: 'movieTabs.new' }));
    const titles = screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent);
    expect(titles).toEqual(['Future', 'Released']);
  });

  it('shows an empty state when a tab has no movies', () => {
    useMoviesMock.mockReturnValue({ data: { data: [] } });
    renderSection();
    expect(screen.getByText('empty')).toBeInTheDocument();
  });
});
