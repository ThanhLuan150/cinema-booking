import '@/i18n';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';

vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));

const useMyRefundsMock = vi.fn();
vi.mock('../hooks/useMyRefunds', () => ({ useMyRefunds: (...args: unknown[]) => useMyRefundsMock(...args) }));

import MyRefundsPage from './MyRefundsPage';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <MyRefundsPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

function refund(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    booking_id: 5,
    amount: 100000,
    policy_percent: 100,
    reason: null,
    status: 'REQUESTED',
    requested_at: '2026-01-01T10:00:00.000Z',
    decision_reason: null,
    failure_reason: null,
    ...overrides,
  };
}

describe('MyRefundsPage', () => {
  beforeEach(() => useMyRefundsMock.mockReset());

  it('shows an empty state when there are no refund requests', () => {
    useMyRefundsMock.mockReturnValue({ data: { data: [], total: 0 }, isLoading: false });
    renderPage();
    expect(screen.getByText(/no refund requests/i)).toBeInTheDocument();
  });

  it('renders a refund row with its booking, amount and status', () => {
    useMyRefundsMock.mockReturnValue({ data: { data: [refund()], total: 1 }, isLoading: false });
    renderPage();
    expect(screen.getByText('Booking #5')).toBeInTheDocument();
    expect(screen.getByText((content) => content.startsWith('100') && content.endsWith('đ'))).toBeInTheDocument();
    expect(screen.getByText('Requested')).toBeInTheDocument();
  });

  it('shows the rejection reason for a REJECTED refund', () => {
    useMyRefundsMock.mockReturnValue({
      data: { data: [refund({ id: 2, status: 'REJECTED', decision_reason: 'Not eligible' })], total: 1 },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText(/Not eligible/)).toBeInTheDocument();
  });
});
