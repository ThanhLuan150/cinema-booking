import '@/i18n';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';

vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));

const useAdminPaymentsMock = vi.fn();
vi.mock('@/features/payment/hooks/useAdminPayments', () => ({
  useAdminPayments: (...args: unknown[]) => useAdminPaymentsMock(...args),
}));

const requestRefundMutate = vi.fn();
vi.mock('@/features/payment/hooks/useRequestPaymentRefund', () => ({
  useRequestPaymentRefund: () => ({ mutateAsync: requestRefundMutate }),
}));

const confirmRefundMutate = vi.fn();
vi.mock('@/features/payment/hooks/useConfirmPaymentRefund', () => ({
  useConfirmPaymentRefund: () => ({ mutateAsync: confirmRefundMutate }),
}));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...args: unknown[]) => confirmDialogMock(...args) }));

import AdminPaymentsList from './List';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AdminPaymentsList />
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
    amount: 100000,
    status: 'PAID',
    ...overrides,
  };
}

describe('Admin Payments List', () => {
  beforeEach(() => {
    useAdminPaymentsMock.mockReset();
    requestRefundMutate.mockReset();
    confirmRefundMutate.mockReset();
    confirmDialogMock.mockReset();
  });

  it('shows a "Request refund" action for a PAID payment', () => {
    useAdminPaymentsMock.mockReturnValue({ data: { data: [payment()], totalPages: 1 } });
    renderPage();
    expect(screen.getByText('BK-1')).toBeInTheDocument();
    expect(screen.getByText('Request refund')).toBeInTheDocument();
    expect(screen.queryByText('Confirm refund')).not.toBeInTheDocument();
  });

  it('shows a "Confirm refund" action for a REFUND_PENDING payment', () => {
    useAdminPaymentsMock.mockReturnValue({ data: { data: [payment({ status: 'REFUND_PENDING' })], totalPages: 1 } });
    renderPage();
    expect(screen.getByText('Confirm refund')).toBeInTheDocument();
    expect(screen.queryByText('Request refund')).not.toBeInTheDocument();
  });

  it('shows no refund action for a PENDING or FAILED payment', () => {
    useAdminPaymentsMock.mockReturnValue({ data: { data: [payment({ status: 'FAILED' })], totalPages: 1 } });
    renderPage();
    expect(screen.queryByText('Request refund')).not.toBeInTheDocument();
    expect(screen.queryByText('Confirm refund')).not.toBeInTheDocument();
  });

  it('requests a refund after confirming', async () => {
    useAdminPaymentsMock.mockReturnValue({ data: { data: [payment()], totalPages: 1 } });
    confirmDialogMock.mockResolvedValue(true);
    requestRefundMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('Request refund'));
    await waitFor(() => expect(requestRefundMutate).toHaveBeenCalledWith({ id: 1 }));
  });

  it('confirms a refund after confirming', async () => {
    useAdminPaymentsMock.mockReturnValue({ data: { data: [payment({ status: 'REFUND_PENDING' })], totalPages: 1 } });
    confirmDialogMock.mockResolvedValue(true);
    confirmRefundMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('Confirm refund'));
    await waitFor(() => expect(confirmRefundMutate).toHaveBeenCalledWith(1));
  });
});
