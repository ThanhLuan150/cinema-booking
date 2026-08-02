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

vi.mock('../components/CinemaBannerDetail', () => ({ default: () => <div>Banner</div> }));
vi.mock('../components/CinemaMoviesSection', () => ({ default: () => <div>Movies</div> }));
vi.mock('../components/CinemaReviews', () => ({ default: () => <div>Reviews</div> }));

import CinemaDetailPage from './CinemaDetailPage';

describe('CinemaDetailPage', () => {
  it('renders the header, footer and section components', () => {
    const queryClient = new QueryClient();
    const store = configureStore({ reducer: { auth: authReducer } });
    render(
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <CinemaDetailPage />
          </MemoryRouter>
        </Provider>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Banner')).toBeInTheDocument();
    expect(screen.getByText('Movies')).toBeInTheDocument();
    expect(screen.getByText('Reviews')).toBeInTheDocument();
  });
});
