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

const momoPaymentMutate = vi.fn();
vi.mock('../hooks/useMomoPayment', () => ({
  useMomoPayment: () => ({ mutateAsync: momoPaymentMutate, isPending: false }),
}));

import BookSeatPage from './BookSeatPage';

function renderPage(query = '?movieId=1&day=2026-01-01&time=10:00') {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer, booking: bookingReducer } });
  store.dispatch(login({ token: 'tok', userId: '1', role: '1', account: {} as Account }));
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
    useScheduleDetailMock.mockReset();
    useRoomsListMock.mockReset();
    useCombosMock.mockReset();
    validateVoucherMutate.mockReset();
    momoPaymentMutate.mockReset();

    useScheduleIdMock.mockReturnValue({ data: { id: 7 } });
    useScheduleDetailMock.mockReturnValue({ data: { id: 7, room_id: 1, price: 100000 } });
    useRoomsListMock.mockReturnValue({ data: [{ id: 1, cinema_id: 3 }] });
    useCombosMock.mockReturnValue({ data: [] });
  });

  it('shows the no-seat-map message when there are no tickets', () => {
    useBookedSeatsMock.mockReturnValue({ data: [], isLoading: false });
    renderPage();
    expect(screen.getByText('This showtime has no seat map yet')).toBeInTheDocument();
  });

  it('renders the seat grid and updates the total when a seat is selected', () => {
    useBookedSeatsMock.mockReturnValue({
      data: [{ id: 1, seat_code: 'A1', seat_type: 0, status: 1 }],
      isLoading: false,
    });
    renderPage();
    fireEvent.click(screen.getByText('A1'));
    expect(screen.getByText((_, el) => el?.textContent === '100,000đ')).toBeInTheDocument();
  });

  it('does not allow selecting a sold seat', () => {
    useBookedSeatsMock.mockReturnValue({
      data: [{ id: 1, seat_code: 'A1', seat_type: 0, status: 0 }],
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
    fireEvent.change(screen.getByPlaceholderText('Enter code...'), { target: { value: 'save10' } });
    fireEvent.click(screen.getByText('Apply'));
    await waitFor(() =>
      expect(validateVoucherMutate).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'save10', cinema_id: 3 }),
      ),
    );
    expect(
      await screen.findByText((_, el) => el?.tagName === 'P' && !!el.textContent?.includes('10,000đ')),
    ).toBeInTheDocument();
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
});
