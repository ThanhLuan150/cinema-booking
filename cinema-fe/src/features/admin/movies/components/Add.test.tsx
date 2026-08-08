import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import adminMoviesReducer from '../store/adminMoviesSlice';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const useCategoriesMock = vi.fn();
vi.mock('@/features/movies/hooks/useCategories', () => ({ useCategories: () => useCategoriesMock() }));

const useDirectorsCatalogMock = vi.fn();
vi.mock('@/features/admin/directors/hooks/useDirectors', () => ({
  useDirectorsCatalog: () => useDirectorsCatalogMock(),
}));

const useActorsCatalogMock = vi.fn();
vi.mock('@/features/admin/actors/hooks/useActors', () => ({ useActorsCatalog: () => useActorsCatalogMock() }));

const createMovieMutate = vi.fn();
vi.mock('../hooks/useCreateMovie', () => ({
  useCreateMovie: () => ({ mutateAsync: createMovieMutate, isPending: false }),
}));

import Add from './Add';

function renderModal() {
  const store = configureStore({ reducer: { adminMovies: adminMoviesReducer } });
  return { ...render(<Provider store={store}><Add /></Provider>), store };
}

describe('admin movies Add', () => {
  beforeEach(() => {
    useCategoriesMock.mockReset();
    useDirectorsCatalogMock.mockReset();
    useActorsCatalogMock.mockReset();
    createMovieMutate.mockReset();
    useCategoriesMock.mockReturnValue({ data: [{ id: 1, name: 'Action' }, { id: 2, name: 'Comedy' }] });
    useDirectorsCatalogMock.mockReturnValue({ data: { data: [{ id: 1, full_name: 'Director A' }] } });
    useActorsCatalogMock.mockReturnValue({ data: { data: [{ id: 1, full_name: 'Actor A' }] } });
  });

  it('renders the add-movie modal with category, director and actor checkboxes', () => {
    renderModal();
    expect(screen.getByText('movies.add.title')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('Comedy')).toBeInTheDocument();
    expect(screen.getByText('Director A')).toBeInTheDocument();
    expect(screen.getByText('Actor A')).toBeInTheDocument();
  });

  it('reveals character-name/lead fields when an actor is checked', async () => {
    renderModal();
    expect(screen.queryByLabelText('movies.add.cast.role')).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByText('Actor A'));
    });
    expect(screen.getByLabelText('movies.add.cast.role')).toBeInTheDocument();
    expect(screen.getByText('movies.add.cast.isLead')).toBeInTheDocument();
  });

  it('closes the modal via dispatch when cancelled', () => {
    const { store } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'actions.close' }));
    expect(store.getState().adminMovies.showAddModal).toBe(false);
  });
});
