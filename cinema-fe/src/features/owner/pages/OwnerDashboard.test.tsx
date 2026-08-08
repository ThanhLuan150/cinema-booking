import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import ownerDashboardReducer from '../store/ownerDashboardSlice';
import realtimeReducer from '@/features/notifications/realtimeSlice';

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
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => true }) }));

const useMyCinemasMock = vi.fn();
vi.mock('../hooks/useMyCinemas', () => ({ useMyCinemas: (...args: unknown[]) => useMyCinemasMock(...args) }));

const useOwnerDashboardStatsMock = vi.fn();
vi.mock('../hooks/useOwnerDashboardStats', () => ({
  useOwnerDashboardStats: (...args: unknown[]) => useOwnerDashboardStatsMock(...args),
}));

import OwnerDashboard from './OwnerDashboard';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { ownerDashboard: ownerDashboardReducer, realtime: realtimeReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <OwnerDashboard />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('OwnerDashboard', () => {
  beforeEach(() => {
    useMyCinemasMock.mockReset();
    useOwnerDashboardStatsMock.mockReset();
    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Cinema A' }] } });
  });

  it('shows a loading message while stats are unavailable', () => {
    useOwnerDashboardStatsMock.mockReturnValue({ data: undefined });
    renderPage();
    expect(screen.getByText('dashboard.loading')).toBeInTheDocument();
  });

  it('renders stat tiles once loaded', () => {
    useOwnerDashboardStatsMock.mockReturnValue({
      data: {
        revenue: 500000,
        totalTicketsSold: 40,
        occupancyRate: 75,
        scheduleCount: 5,
        revenueByDay: [{ date: '2026-01-01', total: 500000 }],
      },
    });
    renderPage();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('shows an empty state when there is no revenue-by-day data', () => {
    useOwnerDashboardStatsMock.mockReturnValue({
      data: { revenue: 0, totalTicketsSold: 0, occupancyRate: 0, scheduleCount: 0, revenueByDay: [] },
    });
    renderPage();
    expect(screen.getByText('dashboard.noData')).toBeInTheDocument();
  });

  it('requests stats for the cinema selected from the dropdown', () => {
    useOwnerDashboardStatsMock.mockReturnValue({
      data: { revenue: 0, totalTicketsSold: 0, occupancyRate: 0, scheduleCount: 0, revenueByDay: [] },
    });
    renderPage();
    fireEvent.click(screen.getByText('dashboard.allMyCinemas'));
    fireEvent.click(screen.getByText('Cinema A'));
    expect(useOwnerDashboardStatsMock).toHaveBeenLastCalledWith('1');
  });
});
