import '@/i18n';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';

vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));

const useBookingsMock = vi.fn();
vi.mock('../hooks/useBookings', () => ({ useBookings: () => useBookingsMock() }));

const cancelMutate = vi.fn();
vi.mock('../hooks/useCancelBooking', () => ({ useCancelBooking: () => ({ mutateAsync: cancelMutate }) }));

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

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    code: 'BK-1',
    status: 'PAID',
    total_price: 100000,
    discount_amount: 0,
    tickets: [{ id: 1, seat_code: 'A1', seat_type: 0 }],
    movie: { name: 'Movie A', avatar: '' },
    schedule: { movie_date: '2026-01-01', time_begin: '10:00' },
    ...overrides,
  };
}

describe('MyBookingsPage', () => {
  beforeEach(() => {
    useBookingsMock.mockReset();
    cancelMutate.mockReset();
    confirmDialogMock.mockReset();
  });

  it('shows an empty state when there are no bookings', () => {
    useBookingsMock.mockReturnValue({ data: { data: [], total: 0 }, isLoading: false });
    renderPage();
    expect(screen.getByText('You have no tickets yet')).toBeInTheDocument();
  });

  it('renders a booking card grouping all of its seats', () => {
    useBookingsMock.mockReturnValue({
      data: {
        data: [
          booking({
            tickets: [
              { id: 1, seat_code: 'A1', seat_type: 0 },
              { id: 2, seat_code: 'A2', seat_type: 1 },
            ],
          }),
        ],
      },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByText('Movie A')).toBeInTheDocument();
    expect(screen.getByText('Seats: A1 (Standard), A2 (VIP)')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  it('shows the cancel button for a PENDING/PAID booking and cancels after confirming', async () => {
    useBookingsMock.mockReturnValue({ data: { data: [booking({ status: 'PAID' })] }, isLoading: false });
    confirmDialogMock.mockResolvedValue(true);
    cancelMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('Cancel booking'));
    await vi.waitFor(() => expect(cancelMutate).toHaveBeenCalledWith(1));
  });

  it('hides the cancel button for a booking that is already CANCELLED', () => {
    useBookingsMock.mockReturnValue({ data: { data: [booking({ status: 'CANCELLED' })] }, isLoading: false });
    renderPage();
    expect(screen.queryByText('Cancel booking')).not.toBeInTheDocument();
  });

  it('links to the e-tickets page instead of embedding a raw QR code', () => {
    useBookingsMock.mockReturnValue({ data: { data: [booking()] }, isLoading: false });
    renderPage();
    const link = screen.getByText('View e-tickets').closest('a');
    expect(link).toHaveAttribute('href', '/MyTickets');
  });
});
