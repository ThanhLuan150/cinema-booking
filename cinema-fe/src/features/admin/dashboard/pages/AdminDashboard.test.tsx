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

const useAdminDashboardStatsMock = vi.fn();
vi.mock('../hooks/useAdminDashboardStats', () => ({ useAdminDashboardStats: () => useAdminDashboardStatsMock() }));

import AdminDashboard from './AdminDashboard';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AdminDashboard />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('AdminDashboard', () => {
  beforeEach(() => useAdminDashboardStatsMock.mockReset());

  it('shows a loading message while stats are unavailable', () => {
    useAdminDashboardStatsMock.mockReturnValue({ data: undefined });
    renderPage();
    expect(screen.getByText('dashboard.loading')).toBeInTheDocument();
  });

  it('renders stat tiles once loaded', () => {
    useAdminDashboardStatsMock.mockReturnValue({
      data: {
        totalRevenue: 500000,
        totalUsers: 10,
        totalOwners: 2,
        totalCinemas: 3,
        totalTicketsSold: 40,
        totalTransactions: 15,
        revenueByDay: [{ date: '2026-01-01', total: 500000 }],
      },
    });
    renderPage();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows an empty state when there is no revenue data', () => {
    useAdminDashboardStatsMock.mockReturnValue({
      data: {
        totalRevenue: 0,
        totalUsers: 0,
        totalOwners: 0,
        totalCinemas: 0,
        totalTicketsSold: 0,
        totalTransactions: 0,
        revenueByDay: [],
      },
    });
    renderPage();
    expect(screen.getByText('dashboard.noData')).toBeInTheDocument();
  });
});
