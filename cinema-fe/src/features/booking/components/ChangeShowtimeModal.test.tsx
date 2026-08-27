import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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

const useSchedulesMock = vi.fn();
vi.mock('@/features/admin/schedules/hooks/useSchedules', () => ({ useSchedules: (...args: unknown[]) => useSchedulesMock(...args) }));

const useBookedSeatsMock = vi.fn();
vi.mock('../hooks/useBookedSeats', () => ({ useBookedSeats: (...args: unknown[]) => useBookedSeatsMock(...args) }));

const mutateAsync = vi.fn();
vi.mock('../hooks/useChangeBookingShowtime', () => ({
  useChangeBookingShowtime: () => ({ mutateAsync, isPending: false }),
}));

import type { Booking } from '../types/booking.types';
import { ChangeShowtimeModal } from './ChangeShowtimeModal';

const future = new Date(Date.now() + 48 * 60 * 60 * 1000);
const pad = (n: number) => String(n).padStart(2, '0');
const futureDate = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}`;

const past = new Date(Date.now() - 48 * 60 * 60 * 1000);
const pastDate = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}`;

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 1,
    code: 'BK-1',
    account_id: 1,
    schedule_id: 1,
    branch_id: 1,
    status: 'PAID',
    tickets: [{ id: 1, seat_code: 'A1', seat_type: 0 }],
    combo_ids: [],
    voucher_code: null,
    promotion_code: null,
    discount_amount: 0,
    seat_total: 0,
    combo_total: 0,
    total_price: 100000,
    expires_at: null,
    paid_at: null,
    cancelled_at: null,
    needs_reschedule_response: false,
    movie: { id: 10, name: 'Movie A', avatar: '' },
    createdAt: '',
    ...overrides,
  };
}

describe('ChangeShowtimeModal', () => {
  beforeEach(() => {
    useSchedulesMock.mockReset();
    useBookedSeatsMock.mockReset();
    mutateAsync.mockReset();
    useBookedSeatsMock.mockReturnValue({ data: undefined });
  });

  it('excludes the current schedule, cancelled schedules and past showtimes from the picker', () => {
    useSchedulesMock.mockReturnValue({
      data: {
        data: [
          { id: 1, movie_id: 10, cinema_id: 1, movie_date: futureDate, time_begin: '10:00', status: 'ACTIVE' }, // current — excluded
          { id: 2, movie_id: 10, cinema_id: 1, movie_date: futureDate, time_begin: '14:00', status: 'ACTIVE' }, // valid
          { id: 3, movie_id: 10, cinema_id: 1, movie_date: futureDate, time_begin: '16:00', status: 'CANCELLED' }, // cancelled — excluded
          { id: 4, movie_id: 10, cinema_id: 1, movie_date: pastDate, time_begin: '10:00', status: 'ACTIVE' }, // past — excluded
        ],
      },
    });
    render(<ChangeShowtimeModal booking={booking()} onClose={vi.fn()} onSuccess={vi.fn()} />);
    fireEvent.click(screen.getByText('changeShowtime.schedulePlaceholder'));
    expect(screen.getByText(`${futureDate} 14:00`)).toBeInTheDocument();
    expect(screen.queryByText(`${futureDate} 10:00`)).not.toBeInTheDocument();
    expect(screen.queryByText(`${futureDate} 16:00`)).not.toBeInTheDocument();
  });

  it('shows the seat grid once a schedule is picked and only allows selecting up to the required count', () => {
    useSchedulesMock.mockReturnValue({
      data: { data: [{ id: 2, movie_id: 10, cinema_id: 1, movie_date: futureDate, time_begin: '14:00', status: 'ACTIVE' }] },
    });
    useBookedSeatsMock.mockReturnValue({
      data: [
        { id: 10, seat_code: 'B1', seat_type: 0, status: 1, price: null },
        { id: 11, seat_code: 'B2', seat_type: 0, status: 0, price: null }, // booked — not clickable
      ],
    });
    render(<ChangeShowtimeModal booking={booking()} onClose={vi.fn()} onSuccess={vi.fn()} />);
    fireEvent.click(screen.getByText('changeShowtime.schedulePlaceholder'));
    fireEvent.click(screen.getByText(`${futureDate} 14:00`));

    expect(screen.getByText('B1')).toBeInTheDocument();
    const confirmButton = screen.getByText('common:actions.confirm');
    expect(confirmButton).toBeDisabled();

    fireEvent.click(screen.getByText('B1'));
    expect(confirmButton).not.toBeDisabled();

    // The booked seat is disabled and can't be selected.
    expect(screen.getByText('B2').closest('button')).toBeDisabled();
  });

  it('submits the change and calls onSuccess', async () => {
    useSchedulesMock.mockReturnValue({
      data: { data: [{ id: 2, movie_id: 10, cinema_id: 1, movie_date: futureDate, time_begin: '14:00', status: 'ACTIVE' }] },
    });
    useBookedSeatsMock.mockReturnValue({ data: [{ id: 10, seat_code: 'B1', seat_type: 0, status: 1, price: null }] });
    mutateAsync.mockResolvedValue({});
    const onSuccess = vi.fn();
    render(<ChangeShowtimeModal booking={booking()} onClose={vi.fn()} onSuccess={onSuccess} />);

    fireEvent.click(screen.getByText('changeShowtime.schedulePlaceholder'));
    fireEvent.click(screen.getByText(`${futureDate} 14:00`));
    fireEvent.click(screen.getByText('B1'));
    fireEvent.click(screen.getByText('common:actions.confirm'));

    // The Select component always reports string values, even for numeric option.value.
    await vi.waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ bookingId: 1, schedule_id: '2', seatCodes: ['B1'] }));
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});
