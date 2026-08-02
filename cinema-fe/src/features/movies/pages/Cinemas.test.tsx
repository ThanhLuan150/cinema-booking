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

const getCinemasListMock = vi.fn();
vi.mock('../api/movies.api', () => ({ getCinemasList: (...args: unknown[]) => getCinemasListMock(...args) }));

import Cinemas from './Cinemas';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Cinemas />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Cinemas page', () => {
  beforeEach(() => getCinemasListMock.mockReset());

  it('shows an empty state when there are no cinemas', async () => {
    getCinemasListMock.mockResolvedValue({ data: [], total: 0, totalPages: 1 });
    renderPage();
    expect(await screen.findByText('cinemas.empty')).toBeInTheDocument();
  });

  it('renders a cinema card', async () => {
    getCinemasListMock.mockResolvedValue({
      data: [{ id: 1, name: 'Galaxy Cinema', address: 'Addr', city: 'HN', images: [] }],
      total: 1,
      totalPages: 1,
    });
    renderPage();
    expect(await screen.findByText('Galaxy Cinema')).toBeInTheDocument();
  });
});
