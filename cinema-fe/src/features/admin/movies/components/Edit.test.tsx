import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import adminMoviesReducer, { openEditModal } from '../store/adminMoviesSlice';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const useCategoriesMock = vi.fn();
vi.mock('@/features/movies/hooks/useCategories', () => ({ useCategories: () => useCategoriesMock() }));

const useDirectorsCatalogMock = vi.fn();
vi.mock('@/features/admin/directors/hooks/useDirectors', () => ({
  useDirectorsCatalog: () => useDirectorsCatalogMock(),
}));

const useActorsCatalogMock = vi.fn();
vi.mock('@/features/admin/actors/hooks/useActors', () => ({ useActorsCatalog: () => useActorsCatalogMock() }));

const useMovieDetailMock = vi.fn();
vi.mock('@/features/movies/hooks/useMovieDetail', () => ({ useMovieDetail: (...args: unknown[]) => useMovieDetailMock(...args) }));

const useMovieCategoriesByMovieIdMock = vi.fn();
vi.mock('../hooks/useMovieCategoriesByMovieId', () => ({
  useMovieCategoriesByMovieId: (...args: unknown[]) => useMovieCategoriesByMovieIdMock(...args),
}));

const useMovieDirectorsByMovieIdMock = vi.fn();
vi.mock('../hooks/useMovieDirectorsByMovieId', () => ({
  useMovieDirectorsByMovieId: (...args: unknown[]) => useMovieDirectorsByMovieIdMock(...args),
}));

const useMovieActorsByMovieIdMock = vi.fn();
vi.mock('../hooks/useMovieActorsByMovieId', () => ({
  useMovieActorsByMovieId: (...args: unknown[]) => useMovieActorsByMovieIdMock(...args),
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
    useDirectorsCatalogMock.mockReset();
    useActorsCatalogMock.mockReset();
    useMovieDetailMock.mockReset();
    useMovieCategoriesByMovieIdMock.mockReset();
    useMovieDirectorsByMovieIdMock.mockReset();
    useMovieActorsByMovieIdMock.mockReset();
    updateMovieMutate.mockReset();
    useCategoriesMock.mockReturnValue({ data: [{ id: 1, name: 'Action' }] });
    useDirectorsCatalogMock.mockReturnValue({ data: { data: [{ id: 1, full_name: 'Director A' }] } });
    useActorsCatalogMock.mockReturnValue({ data: { data: [{ id: 1, full_name: 'Actor A' }] } });
    useMovieCategoriesByMovieIdMock.mockReturnValue({ data: [1] });
    useMovieDirectorsByMovieIdMock.mockReturnValue({ data: [{ id: 1, movie_id: 5, director_id: 1 }] });
    useMovieActorsByMovieIdMock.mockReturnValue({
      data: [{ id: 1, movie_id: 5, actor_id: 1, character_name: 'Hero', is_lead: true }],
    });
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
      },
    });
    renderModal();
    expect(screen.getByDisplayValue('Movie A')).toBeInTheDocument();
  });

  it('pre-fills the status select with the movie\'s current status', () => {
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
        status: 'INACTIVE',
      },
    });
    renderModal();
    expect(screen.getByText('movies.status.inactive')).toBeInTheDocument();
  });

  it('pre-checks the movie\'s current director and actor, with the actor\'s character name filled in', () => {
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
      },
    });
    renderModal();
    const directorCheckbox = screen.getByText('Director A').closest('label')?.querySelector('input');
    expect(directorCheckbox).toBeChecked();
    expect(screen.getByDisplayValue('Hero')).toBeInTheDocument();
  });

  it('closes the modal via dispatch when cancelled', () => {
    useMovieDetailMock.mockReturnValue({ data: undefined });
    const { store } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'actions.close' }));
    expect(store.getState().adminMovies.showEditModal).toBe(false);
  });
});
