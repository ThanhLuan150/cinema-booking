import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import adminMoviesReducer, { openEditModal } from '../store/adminMoviesSlice';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const useCategoriesMock = vi.fn();
vi.mock('@/features/movies/hooks/useCategories', () => ({ useCategories: () => useCategoriesMock() }));

const useMovieDetailMock = vi.fn();
vi.mock('@/features/movies/hooks/useMovieDetail', () => ({ useMovieDetail: (...args: unknown[]) => useMovieDetailMock(...args) }));

const useMovieCategoriesByMovieIdMock = vi.fn();
vi.mock('../hooks/useMovieCategoriesByMovieId', () => ({
  useMovieCategoriesByMovieId: (...args: unknown[]) => useMovieCategoriesByMovieIdMock(...args),
}));

const updateMovieMutate = vi.fn();
vi.mock('../hooks/useUpdateMovie', () => ({
  useUpdateMovie: () => ({ mutateAsync: updateMovieMutate, isPending: false }),
}));

import Edit from './Edit';

function renderModal() {
  const store = configureStore({ reducer: { adminMovies: adminMoviesReducer } });
  store.dispatch(openEditModal(5));
  return { ...render(<Provider store={store}><Edit /></Provider>), store };
}

describe('admin movies Edit', () => {
  beforeEach(() => {
    useCategoriesMock.mockReset();
    useMovieDetailMock.mockReset();
    useMovieCategoriesByMovieIdMock.mockReset();
    updateMovieMutate.mockReset();
    useCategoriesMock.mockReturnValue({ data: [{ id: 1, name: 'Action' }] });
    useMovieCategoriesByMovieIdMock.mockReturnValue({ data: [1] });
  });

  it('pre-fills the form with the movie\'s current values', () => {
    useMovieDetailMock.mockReturnValue({
      data: {
        id: 5,
        name: 'Movie A',
        avatar: 'a.jpg',
        premiere_date: '2026-01-01',
        description: 'Desc',
        country: 'US',
        trailer: 't.mp4',
        producer: 'P',
        director: 'D',
        cast: [],
      },
    });
    renderModal();
    expect(screen.getByDisplayValue('Movie A')).toBeInTheDocument();
  });

  it('closes the modal via dispatch when cancelled', () => {
    useMovieDetailMock.mockReturnValue({ data: undefined });
    const { store } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'actions.close' }));
    expect(store.getState().adminMovies.showEditModal).toBe(false);
  });
});
