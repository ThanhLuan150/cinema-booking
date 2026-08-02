import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import adminMoviesReducer from '../store/adminMoviesSlice';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const useCategoriesMock = vi.fn();
vi.mock('@/features/movies/hooks/useCategories', () => ({ useCategories: () => useCategoriesMock() }));

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
    createMovieMutate.mockReset();
    useCategoriesMock.mockReturnValue({ data: [{ id: 1, name: 'Action' }, { id: 2, name: 'Comedy' }] });
  });

  it('renders the add-movie modal with category checkboxes', () => {
    renderModal();
    expect(screen.getByText('movies.add.title')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('Comedy')).toBeInTheDocument();
  });

  it('adds and removes a cast row', async () => {
    renderModal();
    fireEvent.click(screen.getByText('movies.add.cast.add'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getAllByText('movies.add.cast.remove')).toHaveLength(1);
    fireEvent.click(screen.getByText('movies.add.cast.remove'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.queryByText('movies.add.cast.remove')).not.toBeInTheDocument();
  });

  it('closes the modal via dispatch when cancelled', () => {
    const { store } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'actions.close' }));
    expect(store.getState().adminMovies.showAddModal).toBe(false);
  });
});
