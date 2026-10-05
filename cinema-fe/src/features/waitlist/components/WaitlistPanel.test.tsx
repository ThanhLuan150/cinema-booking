import '@/i18n';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import i18n from '@/i18n';
import bookingReducer from '@/features/booking/store/bookingSlice';
import type { ShowtimeWaitlistStatus, WaitlistEntry } from '../types/waitlist.types';

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('@/features/notifications/toast', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));
const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...a: unknown[]) => confirmDialogMock(...a) }));

const useShowtimeWaitlistMock = vi.fn();
const joinMutateAsync = vi.fn();
const cancelMutateAsync = vi.fn();
vi.mock('../hooks/useWaitlist', () => ({
  waitlistQueryKey: ['waitlist'],
  useShowtimeWaitlist: (...args: unknown[]) => useShowtimeWaitlistMock(...args),
  useJoinWaitlist: () => ({ mutateAsync: joinMutateAsync, isPending: false }),
  useCancelWaitlistEntry: () => ({ mutateAsync: cancelMutateAsync, isPending: false }),
}));

vi.mock('@/features/booking/hooks/useBookedSeats', () => ({
  useBookedSeats: () => ({
    data: [
      { id: 3, seat_code: 'A3', seat_type: 0, status: 2, held_by_me: true, price: 90000 },
      { id: 4, seat_code: 'A4', seat_type: 0, status: 2, held_by_me: true, price: 90000 },
    ],
  }),
}));
const holdSeatsMutate = vi.fn();
vi.mock('@/features/booking/hooks/useHoldSeats', () => ({ useHoldSeats: () => ({ mutate: holdSeatsMutate, isPending: false }) }));

import { WaitlistPanel } from './WaitlistPanel';

function entry(overrides: Partial<WaitlistEntry> = {}): WaitlistEntry {
  return {
    id: 31,
    schedule_id: 7,
    seat_count: 2,
    status: 'WAITING',
    position: 3,
    joined_at: '2026-10-05T10:00:00.000Z',
    notified_at: null,
    expires_at: null,
    offered_seat_codes: [],
    booking_id: null,
    booked_at: null,
    expired_at: null,
    cancelled_at: null,
    close_reason: null,
    movie: { id: 1, name: 'Dune', avatar: '' },
    branch: { id: 1, name: 'CineNova Central' },
    showtime: { id: 7, movie_date: '2026-10-05', time_begin: '19:30', time_end: '21:30', room: 'Hall 3', status: 'ACTIVE' },
    ...overrides,
  };
}

function status(overrides: Partial<ShowtimeWaitlistStatus> = {}): ShowtimeWaitlistStatus {
  return {
    schedule_id: 7,
    total_seats: 40,
    available_seats: 0,
    full: true,
    waiting_count: 4,
    max_seat_count: 3,
    offer_minutes: 15,
    can_join: true,
    reason: null,
    entry: null,
    ...overrides,
  };
}

function renderPanel() {
  const store = configureStore({ reducer: { booking: bookingReducer } });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Provider store={store}>
        <WaitlistPanel scheduleId={7} />
      </Provider>
    </QueryClientProvider>,
  );
  return store;
}

describe('WaitlistPanel', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
    confirmDialogMock.mockResolvedValue(true);
  });

  it('stays out of the way while seats are on sale', () => {
    useShowtimeWaitlistMock.mockReturnValue({ data: status({ full: false, available_seats: 5, can_join: false }) });
    renderPanel();
    expect(screen.queryByTestId('waitlist-join')).not.toBeInTheDocument();
    expect(screen.queryByTestId('waitlist-waiting')).not.toBeInTheDocument();
  });

  it('offers a sold-out showtime\'s waitlist, for up to the max seats', async () => {
    useShowtimeWaitlistMock.mockReturnValue({ data: status() });
    joinMutateAsync.mockResolvedValue(entry());
    renderPanel();

    expect(screen.getByText('This showtime is sold out')).toBeInTheDocument();
    expect(screen.getByText('4 people are waiting.')).toBeInTheDocument();
    expect(screen.getByText(/reserved for the first person in line for 15 minutes/)).toBeInTheDocument();

    const more = screen.getByRole('button', { name: 'More seats' });
    fireEvent.click(more);
    fireEvent.click(more);
    fireEvent.click(more);
    expect(screen.getByTestId('waitlist-seat-count')).toHaveTextContent('3');
    expect(more).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Fewer seats' }));

    fireEvent.click(screen.getByRole('button', { name: 'Join waitlist' }));
    await waitFor(() => expect(joinMutateAsync).toHaveBeenCalledWith({ schedule_id: 7, seat_count: 2 }));
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('explains a refused join', async () => {
    useShowtimeWaitlistMock.mockReturnValue({ data: status() });
    joinMutateAsync.mockRejectedValue({ response: { data: { code: 'WAITLIST_DUPLICATE', message: 'dup' } } });
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Join waitlist' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("You're already on the waitlist for this showtime."));
  });

  it('shows a waiting customer their place, and lets them leave', async () => {
    useShowtimeWaitlistMock.mockReturnValue({ data: status({ can_join: false, entry: entry() }) });
    cancelMutateAsync.mockResolvedValue(entry({ status: 'CANCELLED' }));
    renderPanel();

    expect(screen.getByText("You're #3 on the waitlist")).toBeInTheDocument();
    expect(screen.getByText(/Waiting for 2 seats/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Leave waitlist' }));
    await waitFor(() => expect(cancelMutateAsync).toHaveBeenCalledWith(31));
    expect(confirmDialogMock).toHaveBeenCalled();
  });

  it('does not leave when the customer backs out of the confirmation', async () => {
    useShowtimeWaitlistMock.mockReturnValue({ data: status({ can_join: false, entry: entry() }) });
    confirmDialogMock.mockResolvedValue(false);
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Leave waitlist' }));
    await waitFor(() => expect(confirmDialogMock).toHaveBeenCalled());
    expect(cancelMutateAsync).not.toHaveBeenCalled();
  });

  describe('with seats reserved for the customer', () => {
    const offer = () =>
      entry({
        status: 'NOTIFIED',
        position: null,
        notified_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 125_000).toISOString(),
        offered_seat_codes: ['A3', 'A4'],
      });

    it('counts down the offer and names the seats', () => {
      useShowtimeWaitlistMock.mockReturnValue({ data: status({ can_join: false, entry: offer() }) });
      renderPanel();
      expect(screen.getByText('Seats are reserved for you')).toBeInTheDocument();
      expect(screen.getByText(/Seat A3, A4 is being held for you/)).toBeInTheDocument();
      expect(screen.getByLabelText('Time left')).toHaveTextContent(/^2:0[45]$/);
    });

    it('puts the reserved seats into the booking selection', () => {
      useShowtimeWaitlistMock.mockReturnValue({ data: status({ can_join: false, entry: offer() }) });
      const heldUntil = new Date(Date.now() + 120_000).toISOString();
      holdSeatsMutate.mockImplementation((_codes: string[], opts?: { onSuccess?: (r: unknown) => void }) =>
        opts?.onSuccess?.({ held: [], held_until: heldUntil }),
      );
      const store = renderPanel();

      fireEvent.click(screen.getByRole('button', { name: 'Select my reserved seats' }));

      expect(holdSeatsMutate).toHaveBeenCalledWith(['A3', 'A4'], expect.anything());
      expect(store.getState().booking.selectedSeatCodes).toEqual(['A3', 'A4']);
      expect(store.getState().booking.heldUntilBySeat).toEqual({ A3: heldUntil, A4: heldUntil });
      expect(screen.queryByRole('button', { name: 'Select my reserved seats' })).not.toBeInTheDocument();
    });

    it('lets the customer decline, passing the seats on', async () => {
      useShowtimeWaitlistMock.mockReturnValue({ data: status({ can_join: false, entry: offer() }) });
      cancelMutateAsync.mockResolvedValue(offer());
      renderPanel();
      fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
      await waitFor(() => expect(cancelMutateAsync).toHaveBeenCalledWith(31));
      expect(confirmDialogMock).toHaveBeenCalledWith(expect.stringContaining('next person in line'));
    });
  });
});
