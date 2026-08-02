import { describe, expect, it, vi } from 'vitest';
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

vi.mock('../components/BannerDetail', () => ({ default: () => <div>Banner</div> }));
vi.mock('../components/CastSection', () => ({ default: () => <div>Cast</div> }));
vi.mock('../components/DetailTrailer', () => ({ default: () => <div>Trailer</div> }));
vi.mock('../components/OtherMovieSlider', () => ({ default: () => <div>Other</div> }));
vi.mock('../components/MovieReviews', () => ({ default: () => <div>Reviews</div> }));

import MovieDetailPage from './MovieDetailPage';

describe('MovieDetailPage', () => {
  it('renders the header, footer and section components', () => {
    const queryClient = new QueryClient();
    const store = configureStore({ reducer: { auth: authReducer } });
    render(
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <MovieDetailPage />
          </MemoryRouter>
        </Provider>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Banner')).toBeInTheDocument();
    expect(screen.getByText('Cast')).toBeInTheDocument();
    expect(screen.getByText('Trailer')).toBeInTheDocument();
    expect(screen.getByText('Reviews')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
  });
});
