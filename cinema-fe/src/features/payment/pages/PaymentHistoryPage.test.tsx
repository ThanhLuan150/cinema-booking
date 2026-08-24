import '@/i18n';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';

vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));

const useMyPaymentsMock = vi.fn();
vi.mock('../hooks/useMyPayments', () => ({ useMyPayments: (...args: unknown[]) => useMyPaymentsMock(...args) }));

import PaymentHistoryPage from './PaymentHistoryPage';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <PaymentHistoryPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    code: 'BK-1',
    type: 'ONLINE',
    method: 'MOMO',
    amount: 100000,
    status: 'PAID',
    createdAt: '2026-01-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('PaymentHistoryPage', () => {
  beforeEach(() => useMyPaymentsMock.mockReset());

  it('shows an empty state when there are no payments', () => {
    useMyPaymentsMock.mockReturnValue({ data: { data: [], total: 0 }, isLoading: false });
    renderPage();
    expect(screen.getByText(/no payment/i)).toBeInTheDocument();
  });

  it('renders a payment row with its code, amount and status', () => {
    useMyPaymentsMock.mockReturnValue({ data: { data: [payment()], total: 1 }, isLoading: false });
    renderPage();
    expect(screen.getByText('BK-1')).toBeInTheDocument();
    expect(screen.getByText((content) => content.startsWith('100') && content.endsWith('đ'))).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  it('renders a REFUND_PENDING payment with its status label', () => {
    useMyPaymentsMock.mockReturnValue({
      data: { data: [payment({ id: 2, code: 'BK-2', status: 'REFUND_PENDING' })], total: 1 },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByText('Refund pending')).toBeInTheDocument();
  });
});
