import '@/i18n';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';

vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));

const useMyGiftCardsMock = vi.fn();
vi.mock('../hooks/useMyGiftCards', () => ({ useMyGiftCards: (...args: unknown[]) => useMyGiftCardsMock(...args) }));

const useGiftCardHistoryMock = vi.fn();
vi.mock('../hooks/useGiftCardHistory', () => ({ useGiftCardHistory: (...args: unknown[]) => useGiftCardHistoryMock(...args) }));

const redeemMutateAsyncMock = vi.fn();
vi.mock('../hooks/useRedeemGiftCard', () => ({
  useRedeemGiftCard: () => ({ mutateAsync: redeemMutateAsyncMock, isPending: false }),
}));

import MyGiftCardsPage from './MyGiftCardsPage';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <MyGiftCardsPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('MyGiftCardsPage', () => {
  beforeEach(() => {
    useMyGiftCardsMock.mockReset();
    useGiftCardHistoryMock.mockReset();
    redeemMutateAsyncMock.mockReset();
    useGiftCardHistoryMock.mockReturnValue({ data: { data: [], totalPages: 1 }, isLoading: false });
  });

  it('renders the gift card list with balance and status', () => {
    useMyGiftCardsMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            code: 'GC100',
            initial_balance: 100000,
            remaining_balance: 60000,
            currency: 'VND',
            expires_at: null,
            status: 'ACTIVE',
          },
        ],
        totalPages: 1,
      },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByText('GC100')).toBeInTheDocument();
    expect(screen.getByText(/60,000/)).toBeInTheDocument();
  });

  it('shows the empty state when there are no gift cards', () => {
    useMyGiftCardsMock.mockReturnValue({ data: { data: [], totalPages: 1 }, isLoading: false });
    renderPage();
    expect(screen.getByText('You have no gift cards yet.')).toBeInTheDocument();
  });

  it('redeems a gift card code', async () => {
    useMyGiftCardsMock.mockReturnValue({ data: { data: [], totalPages: 1 }, isLoading: false });
    redeemMutateAsyncMock.mockResolvedValue({ id: 1, code: 'GC1' });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Enter gift card code...'), { target: { value: 'gc1' } });
    fireEvent.click(screen.getByText('Redeem'));
    await waitFor(() => expect(redeemMutateAsyncMock).toHaveBeenCalledWith('gc1'));
  });
});
