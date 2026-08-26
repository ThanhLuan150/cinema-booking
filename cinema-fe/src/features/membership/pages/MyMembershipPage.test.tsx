import '@/i18n';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';

vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));

const useMyMembershipMock = vi.fn();
vi.mock('../hooks/useMyMembership', () => ({ useMyMembership: () => useMyMembershipMock() }));

const useMyPointsHistoryMock = vi.fn();
vi.mock('../hooks/useMyPointsHistory', () => ({ useMyPointsHistory: (...args: unknown[]) => useMyPointsHistoryMock(...args) }));

const redeemMutateAsyncMock = vi.fn();
vi.mock('../hooks/useRedeemPoints', () => ({
  useRedeemPoints: () => ({ mutateAsync: redeemMutateAsyncMock, isPending: false }),
}));

import MyMembershipPage from './MyMembershipPage';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <MyMembershipPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

function summary(overrides: Record<string, unknown> = {}) {
  return {
    membership_level: 'SILVER',
    membership_level_name: 'Silver',
    points_balance: 400,
    lifetime_points: 1200,
    next_level: { code: 'GOLD', name: 'Gold', min_points: 5000000 },
    points_to_next_level: 4998800,
    ...overrides,
  };
}

describe('MyMembershipPage', () => {
  beforeEach(() => {
    useMyMembershipMock.mockReset();
    useMyPointsHistoryMock.mockReset();
    redeemMutateAsyncMock.mockReset();
  });

  it('shows the current tier and points balance', () => {
    useMyMembershipMock.mockReturnValue({ data: summary(), isLoading: false });
    useMyPointsHistoryMock.mockReturnValue({ data: { data: [], total: 0, totalPages: 1 }, isLoading: false });
    renderPage();
    expect(screen.getByText('Silver')).toBeInTheDocument();
    expect(screen.getByText('400')).toBeInTheDocument();
  });

  it('shows the top-tier message when there is no next level', () => {
    useMyMembershipMock.mockReturnValue({
      data: summary({ next_level: null, points_to_next_level: 0, membership_level: 'PLATINUM', membership_level_name: 'Platinum' }),
      isLoading: false,
    });
    useMyPointsHistoryMock.mockReturnValue({ data: { data: [], total: 0, totalPages: 1 }, isLoading: false });
    renderPage();
    expect(screen.getByText(/highest membership tier/i)).toBeInTheDocument();
  });

  it('shows an empty state when there is no points history', () => {
    useMyMembershipMock.mockReturnValue({ data: summary(), isLoading: false });
    useMyPointsHistoryMock.mockReturnValue({ data: { data: [], total: 0, totalPages: 1 }, isLoading: false });
    renderPage();
    expect(screen.getByText(/no points activity/i)).toBeInTheDocument();
  });

  it('renders a points transaction row with its type and signed amount', () => {
    useMyMembershipMock.mockReturnValue({ data: summary(), isLoading: false });
    useMyPointsHistoryMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            type: 'EARN',
            points: 10,
            description: 'Booking BK-1',
            createdAt: '2026-01-01T10:00:00.000Z',
          },
        ],
        total: 1,
        totalPages: 1,
      },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByText('Earned')).toBeInTheDocument();
    expect(screen.getByText('+10')).toBeInTheDocument();
    expect(screen.getByText('Booking BK-1')).toBeInTheDocument();
  });

  it('disables the redeem button when the balance is 0', () => {
    useMyMembershipMock.mockReturnValue({ data: summary({ points_balance: 0 }), isLoading: false });
    useMyPointsHistoryMock.mockReturnValue({ data: { data: [], total: 0, totalPages: 1 }, isLoading: false });
    renderPage();
    expect(screen.getByRole('button', { name: /redeem points/i })).toBeDisabled();
  });
});
