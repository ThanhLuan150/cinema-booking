import '@/i18n';
import i18n from '@/i18n';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';
import type { GroupBookingQuote } from '../types/groupBooking.types';

vi.mock('@/components/layout/Header', () => ({ Header: () => null }));
vi.mock('@/components/layout/Footer', () => ({ Footer: () => null }));
vi.mock('@/features/movies/hooks/useMovieDetail', () => ({ useMovieDetail: () => ({ data: { id: 1, name: 'Dune: Part Three' } }) }));
vi.mock('@/features/booking/hooks/useScheduleId', () => ({ useScheduleId: () => ({ data: { id: 7 } }) }));
vi.mock('@/features/booking/hooks/useScheduleDetail', () => ({ useScheduleDetail: () => ({ data: { id: 7, room_id: 5 } }) }));
vi.mock('@/features/booking/hooks/useRoomsList', () => ({ useRoomsList: () => ({ data: [{ id: 5, cinema_id: 1 }] }) }));
vi.mock('@/features/booking/hooks/useRoomSeats', () => ({ useRoomSeats: () => ({ data: [] }) }));
vi.mock('@/features/booking/hooks/useCombos', () => ({
  useCombos: () => ({
    data: [
      { id: 1, cinema_id: 1, name: 'Popcorn', price: 50000, active: true, type: 'FOOD' },
      { id: 2, cinema_id: 1, name: 'Drink', price: 30000, active: true, type: 'BEVERAGE' },
      { id: 3, cinema_id: 1, name: 'Old Hotdog', price: 40000, active: false, type: 'FOOD' },
      { id: 4, cinema_id: 2, name: 'Nachos', price: 60000, active: true, type: 'FOOD' },
    ],
  }),
}));
const seats = vi.hoisted(() => ({
  data: [
    { id: 1, seat_code: 'A1', seat_type: 0, status: 1, price: 100000 },
    { id: 2, seat_code: 'A2', seat_type: 0, status: 1, price: 100000 },
    { id: 3, seat_code: 'A3', seat_type: 0, status: 1, price: 100000 },
    { id: 4, seat_code: 'A4', seat_type: 0, status: 0, price: 100000 },
  ],
}));
vi.mock('@/features/booking/hooks/useBookedSeats', () => ({ useBookedSeats: () => ({ data: seats.data, isLoading: false }) }));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@/features/notifications/toast', () => ({ toast: toastMock }));

const api = vi.hoisted(() => ({
  quoteGroupBooking: vi.fn(),
  createGroupBooking: vi.fn(),
  getGroupBooking: vi.fn(),
  cancelGroupBooking: vi.fn(),
  confirmGroupBookingPayment: vi.fn(),
}));
vi.mock('../api/groupBooking.api', () => api);

import GroupBookingPage from './GroupBookingPage';

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

function quote(overrides: Partial<GroupBookingQuote> = {}): GroupBookingQuote {
  return {
    schedule_id: 7,
    seat_count: 3,
    seats: [],
    combos: [{ combo_id: 1, name: 'Popcorn', type: 'FOOD', unit_price: 50000, quantity: 2, line_total: 100000 }],
    seat_total: 300000,
    combo_total: 100000,
    order_value: 400000,
    discount: { source: 'GROUP_PROMOTION', code: 'GROUP3', name: 'Group of 3', amount: 40000, min_tickets: 3 },
    total_price: 360000,
    unavailable_seat_codes: [],
    stock_shortages: [],
    limits: { min_seats: 2, max_seats: 50 },
    ...overrides,
  };
}

function Probe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: { auth: { accessToken: 'token', userId: '10', role: '1', account: null } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter
          initialEntries={['/GroupBooking?movieId=1&day=2026-10-20&time=19:30']}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/GroupBooking" element={<GroupBookingPage />} />
            <Route path="/GroupBooking/:code" element={<Probe />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

const seat = (code: string) => screen.getByRole('button', { name: code });

async function selectThreeSeatsAndTwoPopcorn() {
  fireEvent.click(seat('A3'));
  fireEvent.click(seat('A1'));
  fireEvent.click(seat('A2'));
  fireEvent.click(screen.getByRole('button', { name: 'One more Popcorn' }));
  fireEvent.click(screen.getByRole('button', { name: 'One more Popcorn' }));
  await waitFor(() => expect(screen.getByTestId('group-total')).toHaveTextContent('360,000'));
}

describe('GroupBookingPage', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    toastMock.error.mockReset();
    api.quoteGroupBooking.mockResolvedValue(quote());
  });

  it("offers only this branch's combos that are on sale, and never lets a sold seat be picked", () => {
    renderPage();
    expect(screen.getByText('Popcorn')).toBeInTheDocument();
    expect(screen.getByText('Drink')).toBeInTheDocument();
    expect(screen.queryByText('Old Hotdog')).not.toBeInTheDocument();
    expect(screen.queryByText('Nachos')).not.toBeInTheDocument();
    expect(seat('A4')).toBeDisabled();
  });

  it('quotes the selection on the server (no price ever sent) and shows the group discount it found', async () => {
    renderPage();
    await selectThreeSeatsAndTwoPopcorn();

    const payload = api.quoteGroupBooking.mock.calls.at(-1)![0];
    expect(payload).toMatchObject({ schedule_id: 7, ticket_ids: [1, 2, 3], combos: [{ combo_id: 1, quantity: 2 }] });
    expect(JSON.stringify(payload)).not.toMatch(/price|total|amount|discount/);
    expect(screen.getByTestId('group-discount')).toHaveTextContent('Group discount GROUP3 (3+ tickets)');
    expect(screen.getByTestId('group-discount')).toHaveTextContent('40,000');
  });

  it('pays once for the whole group and reuses the same Idempotency-Key for the same order', async () => {
    api.createGroupBooking.mockResolvedValue({
      booking: { code: 'GB-1', status: 'PENDING' },
      pay_url: 'https://pay.example/GB-1',
      replayed: false,
    });
    renderPage();
    await selectThreeSeatsAndTwoPopcorn();

    fireEvent.click(screen.getByRole('button', { name: /Pay with MoMo/ }));
    await waitFor(() => expect(api.createGroupBooking).toHaveBeenCalledTimes(1));
    const [payload, key] = api.createGroupBooking.mock.calls[0];
    expect(payload).toMatchObject({ ticket_ids: [1, 2, 3], organizer: { organizer_type: 'CUSTOMER' } });
    expect(key).toEqual(expect.any(String));
    expect(await screen.findByText('Choose how to pay with MoMo')).toBeInTheDocument();

    // The same order again (e.g. a retry) carries the same key, so the server returns the same booking.
    fireEvent.click(screen.getByRole('button', { name: /Pay with MoMo/ }));
    await waitFor(() => expect(api.createGroupBooking).toHaveBeenCalledTimes(2));
    expect(api.createGroupBooking.mock.calls[1][1]).toBe(key);
  });

  it('asks for the company name before paying for a company booking', async () => {
    renderPage();
    await selectThreeSeatsAndTwoPopcorn();
    fireEvent.click(screen.getByRole('radio', { name: /A company/ }));

    fireEvent.click(screen.getByRole('button', { name: /Pay with MoMo/ }));

    expect(await screen.findByText('Enter the company name.')).toBeInTheDocument();
    expect(api.createGroupBooking).not.toHaveBeenCalled();
  });

  it('will not pay while the server says a selected seat is no longer free', async () => {
    api.quoteGroupBooking.mockResolvedValue(quote({ unavailable_seat_codes: ['A2'] }));
    renderPage();
    await selectThreeSeatsAndTwoPopcorn();

    expect(screen.getByText('No longer available: A2. Choose other seats.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pay with MoMo/ })).toBeDisabled();
  });

  it("shows the server's refusal of a seat taken at checkout", async () => {
    api.createGroupBooking.mockRejectedValue({
      response: { data: { code: 'SEAT_UNAVAILABLE', message: 'taken', seatCodes: ['A1'] } },
    });
    renderPage();
    await selectThreeSeatsAndTwoPopcorn();

    fireEvent.click(screen.getByRole('button', { name: /Pay with MoMo/ }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('One or more selected seats are no longer available'));
  });

  it('explains a group that is too small, using the limits the server sent', async () => {
    api.quoteGroupBooking.mockRejectedValue({
      response: { data: { code: 'GROUP_TOO_SMALL', message: 'too small', minSeats: 2, maxSeats: 50 } },
    });
    renderPage();
    fireEvent.click(seat('A1'));

    expect(await screen.findByText('A group booking needs at least 2 seats.')).toBeInTheDocument();
    const summary = screen.getByText('Your group order').closest('aside') as HTMLElement;
    expect(within(summary).getByRole('button', { name: /Pay with MoMo/ })).toBeDisabled();
  });
});
