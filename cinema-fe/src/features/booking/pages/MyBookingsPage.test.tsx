import '@/i18n';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';

vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));

const useMyInvoicesMock = vi.fn();
vi.mock('../hooks/useMyInvoices', () => ({ useMyInvoices: () => useMyInvoicesMock() }));

const cancelMutate = vi.fn();
vi.mock('../hooks/useCancelInvoice', () => ({ useCancelInvoice: () => ({ mutateAsync: cancelMutate }) }));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...args: unknown[]) => confirmDialogMock(...args) }));

import MyBookingsPage from './MyBookingsPage';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <MyBookingsPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('MyBookingsPage', () => {
  beforeEach(() => {
    useMyInvoicesMock.mockReset();
    cancelMutate.mockReset();
    confirmDialogMock.mockReset();
  });

  it('shows an empty state when there are no bookings', () => {
    useMyInvoicesMock.mockReturnValue({ data: [], isLoading: false });
    renderPage();
    expect(screen.getByText('You have no tickets yet')).toBeInTheDocument();
  });

  it('renders a booking card', () => {
    useMyInvoicesMock.mockReturnValue({
      data: [
        {
          id: 1,
          code: 'ABC123',
          status: 1,
          total_price: 100000,
          discount_amount: 0,
          movie: { name: 'Movie A', avatar: '' },
          schedule: { movie_date: '2026-01-01', time_begin: '10:00' },
          ticket: { seat_code: 'A1', seat_type: 0 },
        },
      ],
      isLoading: false,
    });
    renderPage();
    expect(screen.getByText('Movie A')).toBeInTheDocument();
  });

  it('cancels a booking after confirming', async () => {
    useMyInvoicesMock.mockReturnValue({
      data: [
        {
          id: 1,
          code: 'ABC123',
          status: 1,
          total_price: 100000,
          discount_amount: 0,
          movie: { name: 'Movie A', avatar: '' },
          schedule: { movie_date: '2026-01-01', time_begin: '10:00' },
          ticket: { seat_code: 'A1', seat_type: 0 },
        },
      ],
      isLoading: false,
    });
    confirmDialogMock.mockResolvedValue(true);
    cancelMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('Cancel ticket'));
    await vi.waitFor(() => expect(cancelMutate).toHaveBeenCalledWith(1));
  });
});
