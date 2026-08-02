import '@/i18n';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../store/authSlice';

const useCurrentUserMock = vi.fn();
vi.mock('../hooks/useCurrentUser', () => ({ useCurrentUser: () => useCurrentUserMock() }));

const useMyInvoicesMock = vi.fn();
vi.mock('@/features/booking/hooks/useMyInvoices', () => ({ useMyInvoices: () => useMyInvoicesMock() }));

const useMyLikedMoviesMock = vi.fn();
vi.mock('@/features/movies/hooks/useMyLikedMovies', () => ({ useMyLikedMovies: () => useMyLikedMoviesMock() }));

const useFavoriteCinemasMock = vi.fn();
vi.mock('@/features/movies/hooks/useFavoriteCinemas', () => ({ useFavoriteCinemas: () => useFavoriteCinemasMock() }));

vi.mock('@/features/movies/components/Like', () => ({ default: () => <button type="button">Like</button> }));

import ProfilePage from './ProfilePage';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ProfilePage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('ProfilePage', () => {
  beforeEach(() => {
    useMyInvoicesMock.mockReturnValue({ data: [], isLoading: false });
    useMyLikedMoviesMock.mockReturnValue({ data: [], isLoading: false });
    useFavoriteCinemasMock.mockReturnValue({ data: [], isLoading: false });
  });

  it('shows a spinner while the account is loading', () => {
    useCurrentUserMock.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderPage();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows an error message when the account fails to load', () => {
    useCurrentUserMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderPage();
    expect(screen.getByText('Unable to load account information. Please log in again.')).toBeInTheDocument();
  });

  it('renders the profile with empty states when there is no activity', () => {
    useCurrentUserMock.mockReturnValue({
      data: { id: 1, name: 'Alice', email: 'a@b.com', phone: '', avatar: '' },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.getByText("You haven't booked any movies yet")).toBeInTheDocument();
    expect(screen.getByText("You haven't liked any movies yet")).toBeInTheDocument();
    expect(screen.getByText("You haven't favorited any cinemas yet")).toBeInTheDocument();
  });

  it('renders booked movies and favorite cinemas when present', () => {
    useCurrentUserMock.mockReturnValue({
      data: { id: 1, name: 'Alice', email: 'a@b.com', phone: '', avatar: '' },
      isLoading: false,
      isError: false,
    });
    useMyInvoicesMock.mockReturnValue({
      data: [{ movie: { id: 10, name: 'Movie X', avatar: '', categories: [] } }],
      isLoading: false,
    });
    useFavoriteCinemasMock.mockReturnValue({
      data: [{ id: 1, name: 'Cinema A', address: 'Addr', city: 'City' }],
      isLoading: false,
    });
    renderPage();
    expect(screen.getByText('Movie X')).toBeInTheDocument();
    expect(screen.getByText('Cinema A')).toBeInTheDocument();
  });
});
