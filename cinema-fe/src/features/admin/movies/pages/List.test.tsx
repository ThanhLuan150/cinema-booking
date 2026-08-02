import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';
import adminMoviesReducer from '../store/adminMoviesSlice';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: any) =>
        key === 'movies.list.headers' && opts?.returnObjects ? ['ID', 'Poster', 'Name'] : key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));

const useMyMoviesMock = vi.fn();
vi.mock('../hooks/useMyMovies', () => ({ useMyMovies: (...args: unknown[]) => useMyMoviesMock(...args) }));

vi.mock('../components/Add', () => ({ default: () => <div>Add Movie Modal</div> }));
vi.mock('../components/Edit', () => ({ default: () => <div>Edit Movie Modal</div> }));
vi.mock('../components/ListItem', () => ({ default: ({ movie }: any) => <tr><td>{movie.name}</td></tr> }));
vi.mock('../../schedules/components/Add', () => ({ default: () => <div>Add Schedule Modal</div> }));

import AdminMoviesList from './List';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer, adminMovies: adminMoviesReducer } });
  return { ...render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AdminMoviesList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  ), store };
}

describe('Admin Movies List', () => {
  beforeEach(() => useMyMoviesMock.mockReset());

  it('renders movie rows', () => {
    useMyMoviesMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Movie A' }], totalPages: 1 } });
    renderPage();
    expect(screen.getByText('Movie A')).toBeInTheDocument();
  });

  it('opens the add-movie modal', () => {
    useMyMoviesMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    const { store } = renderPage();
    fireEvent.click(screen.getByText('movies.list.addButton'));
    expect(store.getState().adminMovies.showAddModal).toBe(true);
    expect(screen.getByText('Add Movie Modal')).toBeInTheDocument();
  });
});
