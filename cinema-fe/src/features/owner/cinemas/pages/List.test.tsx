import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import ownerCinemasReducer from '../../store/ownerCinemasSlice';
import realtimeReducer from '@/features/notifications/realtimeSlice';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: any) =>
        key === 'cinemas.statusLabels' && opts?.returnObjects ? ['Pending', 'Approved', 'Blocked'] : key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => true }) }));

const useMyCinemasMock = vi.fn();
vi.mock('../../hooks/useMyCinemas', () => ({
  myCinemasQueryKey: ['myCinemas'],
  useMyCinemas: (...args: unknown[]) => useMyCinemasMock(...args),
}));

import CinemaList from './List';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { ownerCinemas: ownerCinemasReducer, realtime: realtimeReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <CinemaList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Owner Cinemas List', () => {
  beforeEach(() => {
    useMyCinemasMock.mockReset();
  });

  it('renders the owner cinemas with their status', () => {
    useMyCinemasMock.mockReturnValue({
      data: { data: [{ id: 1, name: 'Cinema A', address: 'Addr', city: 'HN', status: 0 }] },
    });
    renderPage();
    expect(screen.getByText('Cinema A')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('cinemas.manageRooms')).toBeInTheDocument();
  });
});
