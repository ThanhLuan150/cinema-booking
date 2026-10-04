import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});

vi.mock('@/features/notifications/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const useSeatSwapOptionsMock = vi.fn();
const quoteMutateAsync = vi.fn();
const swapMutateAsync = vi.fn();
vi.mock('../hooks/useSeatSwap', () => ({
  useSeatSwapOptions: (...args: unknown[]) => useSeatSwapOptionsMock(...args),
  useSeatSwapQuote: () => ({ mutateAsync: quoteMutateAsync, isPending: false }),
  useSwapSeat: () => ({ mutateAsync: swapMutateAsync, isPending: false }),
}));

const useBookedSeatsMock = vi.fn();
vi.mock('../hooks/useBookedSeats', () => ({
  useBookedSeats: (...args: unknown[]) => useBookedSeatsMock(...args),
}));
vi.mock('../hooks/useRoomSeats', () => ({
  useRoomSeats: () => ({
    data: [{ id: 3, room_id: 5, seat_code: 'A3', seat_type: 0, status: 'DISABLED' }],
  }),
}));

import type { SeatSwapQuote, Ticket } from '../types/booking.types';
import { SeatSwapModal } from './SeatSwapModal';

const ticket = {
  ticket_id: 1000,
  seat_code: 'A1',
  status: 'ISSUED',
  schedule: { id: 7, movie_date: '2099-01-01', time_begin: '20:00', time_end: '22:00' },
} as unknown as Ticket;

const eligibleOptions = {
  ticket_id: 1000,
  eligible: true,
  reason: null,
  policy: { after_payment: true, price_policy: 'SAME_PRICE_ONLY' },
  seat: { seat_id: 1, seat_code: 'A1', seat_type: 0, price: 90000 },
  showtime: { id: 7, room_id: 5, movie_date: '2099-01-01', time_begin: '20:00' },
};

const grid = [
  { id: 1, seat_code: 'A1', seat_type: 0, status: 0, price: 90000 },
  { id: 2, seat_code: 'A2', seat_type: 0, status: 1, price: 90000 },
  { id: 3, seat_code: 'A3', seat_type: 0, status: 1, price: 90000 },
  { id: 4, seat_code: 'A4', seat_type: 0, status: 0, price: 90000 },
  { id: 5, seat_code: 'V1', seat_type: 1, status: 1, price: 108000 },
];

const sameQuote: SeatSwapQuote = {
  from: { seat_id: 1, seat_code: 'A1', seat_type: 0, price: 90000 },
  to: { seat_id: 2, seat_code: 'A2', seat_type: 0, price: 90000 },
  price_difference: 0,
  settlement: 'NONE',
  price_policy: 'SAME_PRICE_ONLY',
  allowed: true,
};

function renderModal(onSuccess = vi.fn(), onClose = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SeatSwapModal ticket={ticket} onClose={onClose} onSuccess={onSuccess} />
    </QueryClientProvider>,
  );
  return { onSuccess, onClose };
}

const seat = (code: string) => screen.getByRole('button', { name: code });

describe('SeatSwapModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSeatSwapOptionsMock.mockReturnValue({ data: eligibleOptions, isLoading: false });
    useBookedSeatsMock.mockReturnValue({ data: grid, isLoading: false });
  });

  it('explains up front why a ticket cannot change seat (e.g. the policy forbids it after payment)', () => {
    useSeatSwapOptionsMock.mockReturnValue({
      data: {
        ...eligibleOptions,
        eligible: false,
        reason: { code: 'SEAT_SWAP_NOT_ALLOWED_AFTER_PAYMENT', message: 'not allowed' },
      },
      isLoading: false,
    });
    renderModal();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'errors:SEAT_SWAP_NOT_ALLOWED_AFTER_PAYMENT',
    );
    expect(screen.queryByText('seatSwap.confirm')).not.toBeInTheDocument();
    // No seat map is offered (it would only fail).
    expect(useBookedSeatsMock).toHaveBeenCalledWith(null);
  });

  it('only AVAILABLE seats of the same showtime can be picked', () => {
    renderModal();
    expect(useBookedSeatsMock).toHaveBeenCalledWith(7);
    expect(seat('A1')).toBeDisabled(); // the ticket's own seat
    expect(seat('A4')).toBeDisabled(); // sold
    expect(seat('A3')).toBeDisabled(); // out of service
    expect(seat('A2')).toBeEnabled();
    expect(screen.getByText('seatSwap.confirm').closest('button')).toBeDisabled();
  });

  it('select -> check availability -> confirm sends only the seat code and reports success', async () => {
    quoteMutateAsync.mockResolvedValue(sameQuote);
    swapMutateAsync.mockResolvedValue({ swap: { from_seat_code: 'A1', to_seat_code: 'A2' } });
    const { onSuccess, onClose } = renderModal();

    fireEvent.click(seat('A2'));
    expect(quoteMutateAsync).toHaveBeenCalledWith('A2');
    expect(await screen.findByTestId('seat-swap-quote')).toHaveTextContent(
      'seatSwap.settlement.NONE',
    );

    const confirm = screen.getByText('seatSwap.confirm').closest('button')!;
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);
    await waitFor(() => expect(swapMutateAsync).toHaveBeenCalledWith('A2'));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the server-calculated difference when a seat is refused for its price, and blocks confirm', async () => {
    quoteMutateAsync.mockRejectedValue({
      response: {
        data: {
          code: 'SEAT_SWAP_UPGRADE_NOT_ALLOWED',
          quote: {
            ...sameQuote,
            to: { seat_id: 5, seat_code: 'V1', seat_type: 1, price: 108000 },
            price_difference: 18000,
            settlement: null,
            allowed: false,
          },
        },
      },
    });
    renderModal();
    fireEvent.click(seat('V1'));

    expect(await screen.findByText('errors:SEAT_SWAP_UPGRADE_NOT_ALLOWED')).toBeInTheDocument();
    expect(screen.getByTestId('seat-swap-quote')).toHaveTextContent('V1');
    expect(screen.getByTestId('seat-swap-quote')).toHaveTextContent('+');
    expect(screen.getByText('seatSwap.confirm').closest('button')).toBeDisabled();
    expect(swapMutateAsync).not.toHaveBeenCalled();
  });

  it('a seat lost to someone else at confirm time shows the error and asks for a new pick', async () => {
    quoteMutateAsync.mockResolvedValue(sameQuote);
    swapMutateAsync.mockRejectedValue({ response: { data: { code: 'SEAT_UNAVAILABLE' } } });
    const { onSuccess } = renderModal();

    fireEvent.click(seat('A2'));
    const confirm = screen.getByText('seatSwap.confirm').closest('button')!;
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);

    expect(await screen.findByText('errors:SEAT_UNAVAILABLE')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    await waitFor(() => expect(confirm).toBeDisabled());
  });
});
