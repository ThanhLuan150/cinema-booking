import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/features/movies/components/Like', () => ({ default: () => <button>Like</button> }));

const useMoviesMock = vi.fn();
vi.mock('@/features/movies/hooks/useMovies', () => ({ useMovies: (...args: unknown[]) => useMoviesMock(...args) }));

import CinemaMoviesSection from './CinemaMoviesSection';

function renderWithId() {
  return render(
    <MemoryRouter initialEntries={['/Cinema/5']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/Cinema/:id" element={<CinemaMoviesSection />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CinemaMoviesSection', () => {
  beforeEach(() => useMoviesMock.mockReset());

  it('shows a spinner while loading', () => {
    useMoviesMock.mockReturnValue({ data: undefined, isLoading: true });
    renderWithId();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows an empty state when there are no movies', () => {
    useMoviesMock.mockReturnValue({ data: { data: [] }, isLoading: false });
    renderWithId();
    expect(screen.getByText('moviesSection.emptyState')).toBeInTheDocument();
  });

  it('renders a movie card and scopes the query to the cinema id', () => {
    useMoviesMock.mockReturnValue({
      data: { data: [{ id: 1, name: 'Movie A', avatar: '', categories: [] }] },
      isLoading: false,
    });
    renderWithId();
    expect(screen.getByText('Movie A')).toBeInTheDocument();
    expect(useMoviesMock).toHaveBeenCalledWith({ cinema: '5' }, expect.anything());
  });
});
