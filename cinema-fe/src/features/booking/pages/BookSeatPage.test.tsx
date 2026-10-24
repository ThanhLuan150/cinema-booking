import '@/i18n';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer, { login } from '@/features/auth/store/authSlice';
import bookingReducer from '../store/bookingSlice';
import type { Account } from '@/types/entities';

vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));
vi.mock('@/features/movies/hooks/useMovieDetail', () => ({
  useMovieDetail: () => ({ data: { id: 1, name: 'Movie A' } }),
}));

const useScheduleIdMock = vi.fn();
vi.mock('../hooks/useScheduleId', () => ({ useScheduleId: (...args: unknown[]) => useScheduleIdMock(...args) }));

const useBookedSeatsMock = vi.fn();
vi.mock('../hooks/useBookedSeats', () => ({ useBookedSeats: (...args: unknown[]) => useBookedSeatsMock(...args) }));

const useRoomSeatsMock = vi.fn();
vi.mock('../hooks/useRoomSeats', () => ({ useRoomSeats: (...args: unknown[]) => useRoomSeatsMock(...args) }));

const holdSeatsMutate = vi.fn(
  (_seatCodes: string[], opts?: { onSuccess?: () => void; onError?: (error: unknown) => void }) =>
    opts?.onSuccess?.(),
);
vi.mock('../hooks/useHoldSeats', () => ({ useHoldSeats: () => ({ mutate: holdSeatsMutate, isPending: false }) }));

const releaseSeatsMutate = vi.fn();
vi.mock('../hooks/useReleaseSeats', () => ({
  useReleaseSeats: () => ({ mutate: releaseSeatsMutate, isPending: false }),
}));

const useScheduleDetailMock = vi.fn();
vi.mock('../hooks/useScheduleDetail', () => ({
  useScheduleDetail: (...args: unknown[]) => useScheduleDetailMock(...args),
}));

const useRoomsListMock = vi.fn();
vi.mock('../hooks/useRoomsList', () => ({ useRoomsList: (...args: unknown[]) => useRoomsListMock(...args) }));

const useCombosMock = vi.fn();
vi.mock('../hooks/useCombos', () => ({ useCombos: () => useCombosMock() }));

const validateVoucherMutate = vi.fn();
vi.mock('../hooks/useValidateVoucher', () => ({
  useValidateVoucher: () => ({ mutateAsync: validateVoucherMutate }),
}));

const validatePromotionMutate = vi.fn();
vi.mock('../hooks/useValidatePromotion', () => ({
  useValidatePromotion: () => ({ mutateAsync: validatePromotionMutate }),
}));

const momoPaymentMutate = vi.fn();
vi.mock('../hooks/useMomoPayment', () => ({
  useMomoPayment: () => ({ mutateAsync: momoPaymentMutate, isPending: false }),
}));

const validateGiftCardMutate = vi.fn();
vi.mock('@/features/giftCards/hooks/useValidateGiftCard', () => ({
  useValidateGiftCard: () => ({ mutateAsync: validateGiftCardMutate, isPending: false }),
}));

const payWithGiftCardMutate = vi.fn();
vi.mock('@/features/giftCards/hooks/usePayWithGiftCard', () => ({
  usePayWithGiftCard: () => ({ mutateAsync: payWithGiftCardMutate, isPending: false }),
}));

vi.mock('@/features/waitlist/components/WaitlistPanel', () => ({
  WaitlistPanel: ({ scheduleId }: { scheduleId: number | null }) => <div data-testid="waitlist-panel">{scheduleId}</div>,
}));

const useMembershipPreviewMock = vi.fn();
vi.mock('@/features/membership/hooks/useSubscriptions', () => ({
  useMembershipPreview: (...args: unknown[]) => useMembershipPreviewMock(...args),
  useSaleAccess: () => ({ data: undefined }),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

function memberPreview(overrides: Record<string, unknown> = {}) {
  return {
    seat_total: 100000,
    combo_total: 0,
    order_value: 100000,
    membership: {
      level: 'GOLD',
      subscription_id: 9,
      free_tickets: { requested: 0, applied: 0, available: 1 },
      covered_ticket_ids: [],
      free_ticket_amount: 0,
      ticket_discount_percent: 10,
      ticket_discount_amount: 10000,
      fnb_discount_percent: 0,
      fnb_discount_amount: 0,
      total: 10000,
      ...overrides,
    },
    value_after_membership: 90000,
    code_discount: 0,
    total_price: 90000,
    sale: { open: true, priority: false, opens_at: null, general_opens_at: null },
  };
}

import BookSeatPage from './BookSeatPage';

function renderPage(query = '?movieId=1&day=2026-01-01&time=10:00') {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer, booking: bookingReducer } });
  store.dispatch(login({ accessToken: 'tok', userId: '1', role: '1', account: {} as Account }));
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter initialEntries={[`/BookSeat${query}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <BookSeatPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('BookSeatPage', () => {
  beforeEach(() => {
    useScheduleIdMock.mockReset();
    useBookedSeatsMock.mockReset();
    useRoomSeatsMock.mockReset();
    useScheduleDetailMock.mockReset();
    useRoomsListMock.mockReset();
    useCombosMock.mockReset();
    validateVoucherMutate.mockReset();
    validatePromotionMutate.mockReset();
    momoPaymentMutate.mockReset();
    holdSeatsMutate.mockReset();
    holdSeatsMutate.mockImplementation((_seatCodes: string[], opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
    releaseSeatsMutate.mockReset();

    useScheduleIdMock.mockReturnValue({ data: { id: 7 } });
    useScheduleDetailMock.mockReturnValue({ data: { id: 7, room_id: 1, price: 100000 } });
    useRoomsListMock.mockReturnValue({ data: [{ id: 1, cinema_id: 3 }] });
    useRoomSeatsMock.mockReturnValue({ data: [] });
    useCombosMock.mockReturnValue({ data: [] });
    useMembershipPreviewMock.mockReset();
    useMembershipPreviewMock.mockReturnValue({ data: undefined });
    navigateMock.mockReset();
  });

  it('shows the waitlist panel for the resolved showtime', () => {
    useBookedSeatsMock.mockReturnValue({ data: [], isLoading: false });
    renderPage();
    expect(screen.getByTestId('waitlist-panel')).toHaveTextContent('7');
  });

  it('shows the no-seat-map message when there are no tickets', () => {
    useBookedSeatsMock.mockReturnValue({ data: [], isLoading: false });
    renderPage();
    expect(screen.getByText('This showtime has no seat map yet')).toBeInTheDocument();
  });

  it('renders the seat grid and holds + selects a seat from the backend, updating the total', () => {
    useBookedSeatsMock.mockReturnValue({
      data: [{ id: 1, seat_code: 'A1', seat_type: 0, status: 1, price: 100000 }],
      isLoading: false,
    });
    renderPage();
    fireEvent.click(screen.getByText('A1'));
    expect(holdSeatsMutate).toHaveBeenCalledWith(['A1'], expect.anything());
    expect(screen.getByText((_, el) => el?.textContent === '100,000đ')).toBeInTheDocument();
  });

  it('deselecting a held seat releases it', () => {
    useBookedSeatsMock.mockReturnValue({
      data: [{ id: 1, seat_code: 'A1', seat_type: 0, status: 1 }],
      isLoading: false,
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'A1' }));
    fireEvent.click(screen.getByRole('button', { name: 'A1' }));
    expect(releaseSeatsMutate).toHaveBeenCalledWith(['A1']);
    expect(screen.getByText('0đ')).toBeInTheDocument();
  });

  it('does not allow selecting a sold seat', () => {
    useBookedSeatsMock.mockReturnValue({
      data: [{ id: 1, seat_code: 'A1', seat_type: 0, status: 0 }],
      isLoading: false,
    });
    renderPage();
    fireEvent.click(screen.getByText('A1'));
    expect(screen.getByText('0đ')).toBeInTheDocument();
    expect(holdSeatsMutate).not.toHaveBeenCalled();
  });

  it('does not allow selecting a seat held by another customer, even though it renders in the grid', () => {
    useBookedSeatsMock.mockReturnValue({
      data: [{ id: 1, seat_code: 'A1', seat_type: 0, status: 2, held_by_me: false }],
      isLoading: false,
    });
    renderPage();
    fireEvent.click(screen.getByText('A1'));
    expect(screen.getByText('0đ')).toBeInTheDocument();
    expect(holdSeatsMutate).not.toHaveBeenCalled();
  });

  it('does not allow selecting a seat the room map marks DISABLED, even without a ticket for it', () => {
    useRoomSeatsMock.mockReturnValue({
      data: [
        { id: 1, room_id: 1, row: 'A', number: 1, seat_code: 'A1', seat_type: 0, status: 'DISABLED' },
        { id: 2, room_id: 1, row: 'A', number: 2, seat_code: 'A2', seat_type: 0, status: 'ACTIVE' },
      ],
    });
    useBookedSeatsMock.mockReturnValue({
      data: [{ id: 2, seat_code: 'A2', seat_type: 0, status: 1 }],
      isLoading: false,
    });
    renderPage();
    expect(screen.getByText('A1')).toBeInTheDocument();
    fireEvent.click(screen.getByText('A1'));
    expect(holdSeatsMutate).not.toHaveBeenCalled();
    expect(screen.getByText('0đ')).toBeInTheDocument();
  });

  it('rejects the selection when the backend reports the seat is no longer available', () => {
    holdSeatsMutate.mockImplementation(
      (_seatCodes: string[], opts?: { onError?: (error: unknown) => void }) =>
        opts?.onError?.(new Error('conflict')),
    );
    useBookedSeatsMock.mockReturnValue({
      data: [{ id: 1, seat_code: 'A1', seat_type: 0, status: 1 }],
      isLoading: false,
    });
    renderPage();
    fireEvent.click(screen.getByText('A1'));
    expect(screen.getByText('0đ')).toBeInTheDocument();
  });

  it('applies a voucher and shows the discount', async () => {
    useBookedSeatsMock.mockReturnValue({
      data: [{ id: 1, seat_code: 'A1', seat_type: 0, status: 1 }],
      isLoading: false,
    });
    validateVoucherMutate.mockResolvedValue({ discount_amount: 10000, code: 'SAVE10' });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Enter voucher code...'), { target: { value: 'save10' } });
    fireEvent.click(screen.getAllByText('Apply')[0]);
    await waitFor(() =>
      expect(validateVoucherMutate).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'save10', cinema_id: 3 }),
      ),
    );
    expect(
      await screen.findByText((_, el) => el?.tagName === 'P' && !!el.textContent?.includes('10,000đ')),
    ).toBeInTheDocument();
  });

  it('applies a promotion and shows the discount', async () => {
    useBookedSeatsMock.mockReturnValue({
      data: [{ id: 1, seat_code: 'A1', seat_type: 0, status: 1 }],
      isLoading: false,
    });
    validatePromotionMutate.mockResolvedValue({ discount_amount: 15000, code: 'PROMO15' });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Enter promotion code...'), { target: { value: 'promo15' } });
    fireEvent.click(screen.getAllByText('Apply')[1]);
    await waitFor(() =>
      expect(validatePromotionMutate).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'promo15', branch_id: 3, movie_id: 1, showtime_id: 7 }),
      ),
    );
    expect(
      await screen.findByText((_, el) => el?.tagName === 'P' && !!el.textContent?.includes('15,000đ')),
    ).toBeInTheDocument();
  });

  it('only allows one of a voucher or a promotion to be applied at a time', async () => {
    useBookedSeatsMock.mockReturnValue({
      data: [{ id: 1, seat_code: 'A1', seat_type: 0, status: 1 }],
      isLoading: false,
    });
    validateVoucherMutate.mockResolvedValue({ discount_amount: 10000, code: 'SAVE10' });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Enter voucher code...'), { target: { value: 'save10' } });
    fireEvent.click(screen.getAllByText('Apply')[0]);
    await waitFor(() => expect(validateVoucherMutate).toHaveBeenCalled());

    expect(screen.getByPlaceholderText('Enter promotion code...')).toBeDisabled();
    expect(screen.getAllByText('Apply')[1]).toBeDisabled();

    fireEvent.click(screen.getByText('Remove'));
    expect(screen.getByPlaceholderText('Enter promotion code...')).not.toBeDisabled();
    expect(screen.getAllByText('Apply')[1]).not.toBeDisabled();
  });

  it('shows the momo modal after a successful checkout', async () => {
    useBookedSeatsMock.mockReturnValue({
      data: [{ id: 1, seat_code: 'A1', seat_type: 0, status: 1 }],
      isLoading: false,
    });
    momoPaymentMutate.mockResolvedValue('https://momo.pay/redirect');
    renderPage();
    fireEvent.click(screen.getByText('A1'));
    fireEvent.click(screen.getByText('Book & Pay with MoMo'));
    expect(await screen.findByText('Choose how to pay with MoMo')).toBeInTheDocument();
  });

  describe('membership benefits (Ticket 53)', () => {
    const seat = { id: 1, seat_code: 'A1', seat_type: 0, status: 1, price: 100000 };

    it('shows the member discount from the server and charges what is left', async () => {
      useBookedSeatsMock.mockReturnValue({ data: [seat], isLoading: false });
      useMembershipPreviewMock.mockReturnValue({ data: memberPreview() });
      momoPaymentMutate.mockResolvedValue('https://momo.pay/redirect');
      renderPage();
      fireEvent.click(screen.getByText('A1'));

      expect(useMembershipPreviewMock).toHaveBeenLastCalledWith({ ticketIds: [1], comboIds: [], freeTickets: 0 }, true);
      expect(screen.getByText('Member ticket discount (10%)')).toBeInTheDocument();
      expect(screen.getByText((_, el) => el?.textContent === '90,000đ')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Book & Pay with MoMo'));
      await waitFor(() => expect(momoPaymentMutate).toHaveBeenCalled());
      expect(momoPaymentMutate.mock.calls[0][0].payload).toMatchObject({ ticketIds: [1], freeTickets: 0 });
    });

    it('sends the number of free tickets chosen, and goes to the tickets when the membership covers it all', async () => {
      useBookedSeatsMock.mockReturnValue({ data: [seat], isLoading: false });
      useMembershipPreviewMock.mockImplementation((payload: { freeTickets: number }) => ({
        data:
          payload.freeTickets > 0
            ? memberPreview({ free_tickets: { requested: 1, applied: 1, available: 1 }, free_ticket_amount: 100000, ticket_discount_amount: 0, total: 100000 })
            : memberPreview(),
      }));
      momoPaymentMutate.mockResolvedValue({ covered: true, code: 'BK-9', bookingId: 9 });
      renderPage();
      fireEvent.click(screen.getByText('A1'));

      fireEvent.click(screen.getByRole('button', { name: 'Use one more free ticket' }));
      expect(screen.getByTestId('free-tickets-count')).toHaveTextContent('1');
      expect(screen.getByText((_, el) => el?.textContent === '0đ')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Book & Pay with MoMo'));
      await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/MyTickets'));
      expect(momoPaymentMutate.mock.calls[0][0].payload).toMatchObject({ freeTickets: 1 });
      expect(screen.queryByText('Choose how to pay with MoMo')).not.toBeInTheDocument();
    });
  });
});
