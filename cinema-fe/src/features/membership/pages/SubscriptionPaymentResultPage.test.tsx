import '@/i18n';
import i18n from '@/i18n';
import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer, { login } from '@/features/auth/store/authSlice';
import type { Account } from '@/types/entities';

vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));

const confirmMock = vi.fn();
vi.mock('../hooks/useSubscriptions', () => ({
  useConfirmSubscriptionPayment: () => ({ mutateAsync: confirmMock }),
}));

import SubscriptionPaymentResultPage from './SubscriptionPaymentResultPage';

function renderPage(query: string, { loggedIn = true } = {}) {
  const store = configureStore({ reducer: { auth: authReducer } });
  if (loggedIn) store.dispatch(login({ accessToken: 'tok', userId: '1', role: '1', account: {} as Account }));
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <Provider store={store}>
        <MemoryRouter initialEntries={[`/Membership/PaymentResult${query}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SubscriptionPaymentResultPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

const active = {
  status: 'ACTIVE',
  plan: { name: 'Monthly Cinema Pass' },
  end_at: '2026-11-23T03:00:00.000Z',
};

describe('SubscriptionPaymentResultPage', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en');
  });
  beforeEach(() => {
    confirmMock.mockReset();
  });

  it('sends the MoMo result to the server once and reports the activation', async () => {
    confirmMock.mockResolvedValue({ subscription: active, alreadyProcessed: false, refundPending: false });
    renderPage('?orderId=SUB-5&resultCode=0&transId=99');
    expect(await screen.findByText(/Monthly Cinema Pass is active until/)).toBeInTheDocument();
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(confirmMock).toHaveBeenCalledWith({ code: 'SUB-5', params: { orderId: 'SUB-5', resultCode: '0', transId: '99' } });
    expect(screen.getByRole('link', { name: 'Back to My Membership' })).toHaveAttribute('href', '/MyMembership');
  });

  it('shows the server’s refusal (e.g. a failed payment)', async () => {
    confirmMock.mockRejectedValue({ response: { data: { code: 'PAYMENT_FAILED', message: 'User cancelled' } } });
    renderPage('?orderId=SUB-5&resultCode=1006');
    await waitFor(() => expect(confirmMock).toHaveBeenCalled());
    expect(await screen.findByRole('link', { name: 'Back to My Membership' })).toBeInTheDocument();
  });

  it('says a late payment will be refunded', async () => {
    confirmMock.mockResolvedValue({ subscription: { ...active, status: 'CANCELLED' }, alreadyProcessed: false, refundPending: true });
    renderPage('?orderId=SUB-5&resultCode=0');
    expect(await screen.findByText(/your payment will be refunded/)).toBeInTheDocument();
  });

  it('does nothing without a result or a login', () => {
    renderPage('');
    expect(screen.getByText('This page needs a payment result from MoMo.')).toBeInTheDocument();
    renderPage('?orderId=SUB-5&resultCode=0', { loggedIn: false });
    expect(confirmMock).not.toHaveBeenCalled();
  });
});
