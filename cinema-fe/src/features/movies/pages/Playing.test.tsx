import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';
import moviesReducer from '../store/moviesSlice';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));
vi.mock('../components/MovieFilterBar', () => ({ MovieFilterBar: () => <div>Filter Bar</div> }));
vi.mock('../components/Like', () => ({ default: () => <button>Like</button> }));

const getMoviesMock = vi.fn();
vi.mock('../api/movies.api', () => ({ getMovies: (...args: unknown[]) => getMoviesMock(...args) }));

import Playing from './Playing';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer, movies: moviesReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Playing />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Playing page', () => {
  beforeEach(() => getMoviesMock.mockReset());

  it('shows an empty message when there are no playing movies', async () => {
    getMoviesMock.mockResolvedValue({ data: [], total: 0, totalPages: 1 });
    renderPage();
    expect(await screen.findByText('playing.empty')).toBeInTheDocument();
  });

  it('renders a movie card and requests status=playing', async () => {
    getMoviesMock.mockResolvedValue({
      data: [{ id: 1, name: 'Movie A', avatar: '', categories: [] }],
      total: 1,
      totalPages: 1,
    });
    renderPage();
    expect(await screen.findByText('Movie A')).toBeInTheDocument();
    expect(getMoviesMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'playing' }),
      expect.anything(),
    );
  });
});
