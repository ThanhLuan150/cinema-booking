import '@/i18n';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer, { login, logout } from '@/features/auth/store/authSlice';
import bookingReducer from '../store/bookingSlice';
import type { Account } from '@/types/entities';

vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));

const confirmMomoPaymentMutate = vi.fn();
vi.mock('../hooks/useConfirmMomoPayment', () => ({
  useConfirmMomoPayment: () => ({ mutateAsync: confirmMomoPaymentMutate }),
}));

import PaymentResultPage from './PaymentResultPage';

function renderPage(store: ReturnType<typeof configureStore>) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <PaymentResultPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

function buildStore() {
  return configureStore({ reducer: { auth: authReducer, booking: bookingReducer } });
}

describe('PaymentResultPage', () => {
  const originalSearch = window.location.search;

  beforeEach(() => {
    window.history.replaceState({}, '', '/PaymentResult');
  });

  afterEach(() => {
    window.history.replaceState({}, '', `/PaymentResult${originalSearch}`);
  });

  it('shows a failure message when the caller is not logged in', async () => {
    const store = buildStore();
    store.dispatch(logout());
    renderPage(store);
    expect(await screen.findByText('Payment failed')).toBeInTheDocument();
    expect(screen.getByText('You need to log in to confirm the payment.')).toBeInTheDocument();
  });

  it('shows a failure message when resultCode is not 0', async () => {
    window.history.replaceState({}, '', '/PaymentResult?resultCode=1&message=Cancelled');
    const store = buildStore();
    store.dispatch(login({ token: 'tok', userId: '1', role: '1', account: {} as Account }));
    renderPage(store);
    expect(await screen.findByText('Payment failed')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('confirms the payment and shows success', async () => {
    window.history.replaceState({}, '', '/PaymentResult?resultCode=0&orderId=X');
    confirmMomoPaymentMutate.mockResolvedValue({});
    const store = buildStore();
    store.dispatch(login({ token: 'tok', userId: '1', role: '1', account: {} as Account }));
    renderPage(store);
    expect(await screen.findByText('Payment successful')).toBeInTheDocument();
    expect(confirmMomoPaymentMutate).toHaveBeenCalledWith(expect.objectContaining({ resultCode: '0', orderId: 'X' }));
  });

  it('shows a failure message when confirmation fails', async () => {
    window.history.replaceState({}, '', '/PaymentResult?resultCode=0&orderId=X');
    confirmMomoPaymentMutate.mockRejectedValue({ response: { data: { code: 'GENERIC' } } });
    const store = buildStore();
    store.dispatch(login({ token: 'tok', userId: '1', role: '1', account: {} as Account }));
    renderPage(store);
    expect(await screen.findByText('Payment failed')).toBeInTheDocument();
  });
});
