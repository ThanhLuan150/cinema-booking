import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';

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
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ data: { role: 3, cinema_id: 5 } }),
}));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => true }) }));

const useMySchedulesMock = vi.fn();
vi.mock('../hooks/useMySchedules', () => ({ useMySchedules: (...args: unknown[]) => useMySchedulesMock(...args) }));

const useMoviesMock = vi.fn();
vi.mock('@/features/movies/hooks/useMovies', () => ({ useMovies: (...args: unknown[]) => useMoviesMock(...args) }));

const useScheduleSeatsMock = vi.fn();
const refetchSeatsMock = vi.fn();
vi.mock('../hooks/useScheduleSeats', () => ({
  useScheduleSeats: (...args: unknown[]) => useScheduleSeatsMock(...args),
}));

const useCombosMock = vi.fn();
vi.mock('@/features/booking/hooks/useCombos', () => ({ useCombos: (...args: unknown[]) => useCombosMock(...args) }));

const holdSeatsMutate = vi.fn();
vi.mock('@/features/booking/hooks/useHoldSeats', () => ({
  useHoldSeats: () => ({ mutateAsync: holdSeatsMutate, isPending: false }),
}));

const releaseSeatsMutate = vi.fn();
vi.mock('@/features/booking/hooks/useReleaseSeats', () => ({
  useReleaseSeats: () => ({ mutate: releaseSeatsMutate, isPending: false }),
}));

const sellMutate = vi.fn();
vi.mock('../hooks/useBoxOfficeSell', () => ({
  useBoxOfficeSell: () => ({ mutateAsync: sellMutate, isPending: false }),
}));

const useBoxOfficeBookingTicketsMock = vi.fn();
vi.mock('../hooks/useBoxOfficeBookingTickets', () => ({
  useBoxOfficeBookingTickets: (...args: unknown[]) => useBoxOfficeBookingTicketsMock(...args),
}));

const useBookingSearchByCodeMock = vi.fn();
vi.mock('../hooks/useBookingSearchByCode', () => ({
  useBookingSearchByCode: (...args: unknown[]) => useBookingSearchByCodeMock(...args),
}));

const findAccountByEmailMock = vi.fn();
vi.mock('../api/employee.api', () => ({
  findAccountByEmail: (...args: unknown[]) => findAccountByEmailMock(...args),
}));

import BoxOffice from './BoxOffice';

function renderPage(initialPath = '/BoxOffice?scheduleId=1') {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { placeholder: () => ({}) } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter initialEntries={[initialPath]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <BoxOffice />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('BoxOffice', () => {
  beforeEach(() => {
    useMySchedulesMock.mockReset();
    useMoviesMock.mockReset();
    useScheduleSeatsMock.mockReset();
    useCombosMock.mockReset();
    holdSeatsMutate.mockReset();
    releaseSeatsMutate.mockReset();
    sellMutate.mockReset();
    useBoxOfficeBookingTicketsMock.mockReset();
    useBookingSearchByCodeMock.mockReset();
    findAccountByEmailMock.mockReset();

    useMoviesMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Movie A' }] } });
    useMySchedulesMock.mockReturnValue({
      data: { data: [{ id: 1, movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', price: 100000 }] },
    });
    useCombosMock.mockReturnValue({ data: [] });
    useBoxOfficeBookingTicketsMock.mockReturnValue({ data: undefined });
    useBookingSearchByCodeMock.mockReturnValue({ data: undefined });
  });

  it('shows the seat grid for the preselected schedule', () => {
    useScheduleSeatsMock.mockReturnValue({
      data: [{ id: 10, seat_code: 'A1', seat_type: 0, status: 1, price: 100000 }],
      refetch: refetchSeatsMock,
    });
    renderPage();
    expect(screen.getByText('A1')).toBeInTheDocument();
  });

  it('locks the selected seat via holdSeats and reveals the payment section', async () => {
    useScheduleSeatsMock.mockReturnValue({
      data: [{ id: 10, seat_code: 'A1', seat_type: 0, status: 1, price: 100000 }],
      refetch: refetchSeatsMock,
    });
    holdSeatsMutate.mockResolvedValue({ held: [{ id: 10, seat_code: 'A1', status: 2 }], held_until: '2026-01-01T00:00:00Z' });

    renderPage();
    fireEvent.click(screen.getByText('A1'));
    fireEvent.click(screen.getByText('boxOffice.lockSeats'));

    await waitFor(() => expect(holdSeatsMutate).toHaveBeenCalledWith(['A1']));
    expect(screen.getByText('boxOffice.seatsLocked')).toBeInTheDocument();
    expect(screen.getByText('boxOffice.pay')).toBeInTheDocument();
  });

  it('submits a sale with the resolved seats, customer and cinema once locked', async () => {
    useScheduleSeatsMock.mockReturnValue({
      data: [{ id: 10, seat_code: 'A1', seat_type: 0, status: 1, price: 100000 }],
      refetch: refetchSeatsMock,
    });
    holdSeatsMutate.mockResolvedValue({ held: [{ id: 10, seat_code: 'A1', status: 2 }], held_until: '2026-01-01T00:00:00Z' });
    findAccountByEmailMock.mockResolvedValue({ id: 42, email: 'a@b.com' });
    sellMutate.mockResolvedValue({ bookingId: 99, code: 'POS-1', totalPrice: 100000, alreadyProcessed: false });

    renderPage();
    fireEvent.click(screen.getByText('A1'));
    fireEvent.click(screen.getByText('boxOffice.lockSeats'));
    await waitFor(() => expect(screen.getByText('boxOffice.seatsLocked')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('counterSale.customerEmailPlaceholder'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.click(screen.getByText('counterSale.findCustomer'));
    await waitFor(() => expect(findAccountByEmailMock).toHaveBeenCalledWith('a@b.com'));

    await waitFor(() => expect(screen.getByText('boxOffice.pay')).not.toBeDisabled());
    fireEvent.click(screen.getByText('boxOffice.pay'));

    await waitFor(() => expect(sellMutate).toHaveBeenCalled());
    const [{ payload, idempotencyKey }] = sellMutate.mock.calls[0];
    expect(payload).toMatchObject({
      scheduleId: '1',
      ticketIds: [10],
      comboIds: [],
      voucherCode: null,
      promotionCode: null,
      accountId: 42,
      method: 'CASH',
      cinema_id: 5,
    });
    expect(typeof idempotencyKey).toBe('string');
    expect(idempotencyKey.length).toBeGreaterThan(0);
  });

  it('filters the showtime dropdown to the selected movie (Chọn Movie -> Chọn Showtime)', async () => {
    useMoviesMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Movie A' }, { id: 2, name: 'Movie B' }] } });
    useMySchedulesMock.mockReturnValue({
      data: {
        data: [
          { id: 1, movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', price: 100000 },
          { id: 2, movie_id: 2, room_id: 1, movie_date: '2026-01-02', time_begin: '14:00', price: 100000 },
        ],
      },
    });
    useScheduleSeatsMock.mockReturnValue({ data: [], refetch: refetchSeatsMock });

    renderPage('/BoxOffice');

    fireEvent.click(screen.getByText('boxOffice.moviePlaceholder'));
    fireEvent.click(screen.getByText('Movie A'));

    fireEvent.click(screen.getByText('counterSale.schedulePlaceholder'));
    expect(screen.getByText('2026-01-01 10:00')).toBeInTheDocument();
    expect(screen.queryByText('2026-01-02 14:00')).not.toBeInTheDocument();
  });

  it('releases locked seats when the page is left before completing the sale', async () => {
    useScheduleSeatsMock.mockReturnValue({
      data: [{ id: 10, seat_code: 'A1', seat_type: 0, status: 1, price: 100000 }],
      refetch: refetchSeatsMock,
    });
    holdSeatsMutate.mockResolvedValue({ held: [{ id: 10, seat_code: 'A1', status: 2 }], held_until: '2026-01-01T00:00:00Z' });

    const { unmount } = renderPage();
    fireEvent.click(screen.getByText('A1'));
    fireEvent.click(screen.getByText('boxOffice.lockSeats'));
    await waitFor(() => expect(screen.getByText('boxOffice.seatsLocked')).toBeInTheDocument());

    unmount();

    expect(releaseSeatsMutate).toHaveBeenCalledWith(['A1']);
  });

  it('does not release anything on unmount when no seat was ever locked', () => {
    useScheduleSeatsMock.mockReturnValue({
      data: [{ id: 10, seat_code: 'A1', seat_type: 0, status: 1, price: 100000 }],
      refetch: refetchSeatsMock,
    });
    const { unmount } = renderPage();
    unmount();
    expect(releaseSeatsMutate).not.toHaveBeenCalled();
  });

  it('searches for a booking by order code', async () => {
    useScheduleSeatsMock.mockReturnValue({ data: [], refetch: refetchSeatsMock });
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('boxOffice.search.placeholder'), {
      target: { value: 'POS-1' },
    });
    fireEvent.click(screen.getByText('boxOffice.search.action'));

    await waitFor(() => expect(useBookingSearchByCodeMock).toHaveBeenCalledWith('POS-1'));
  });
});
