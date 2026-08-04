import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';

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

const useMoviesMock = vi.fn();
vi.mock('@/features/movies/hooks/useMovies', () => ({ useMovies: () => useMoviesMock() }));

vi.mock('../components/BannerSlider', () => ({ default: () => <div>Banner</div> }));
vi.mock('../components/QuickBooking', () => ({ default: () => <div>QuickBooking</div> }));
vi.mock('../components/MovieTabsSection', () => ({ default: () => <div>MovieTabs</div> }));
vi.mock('../components/TopCinemasSection', () => ({ default: () => <div>TopCinemas</div> }));

import HomePage from './HomePage';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <HomePage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('HomePage', () => {
  beforeEach(() => useMoviesMock.mockReset());

  it('shows a spinner while loading', () => {
    useMoviesMock.mockReturnValue({ data: undefined, isLoading: true });
    renderPage();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Banner')).not.toBeInTheDocument();
  });

  it('renders all the home sections once loaded', () => {
    useMoviesMock.mockReturnValue({ data: { data: [{ id: 1 }] }, isLoading: false });
    renderPage();
    expect(screen.getByText('Banner')).toBeInTheDocument();
    expect(screen.getByText('QuickBooking')).toBeInTheDocument();
    expect(screen.getByText('MovieTabs')).toBeInTheDocument();
    expect(screen.getByText('TopCinemas')).toBeInTheDocument();
  });
});
