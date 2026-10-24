import '@/i18n';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import i18n from '@/i18n';
import authReducer from '@/features/auth/store/authSlice';
import type { WaitlistEntry } from '../types/waitlist.types';

vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));
vi.mock('@/features/notifications/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...a: unknown[]) => confirmDialogMock(...a) }));

const useMyWaitlistMock = vi.fn();
const cancelMutateAsync = vi.fn();
vi.mock('../hooks/useWaitlist', () => ({
  useMyWaitlist: (...args: unknown[]) => useMyWaitlistMock(...args),
  useCancelWaitlistEntry: () => ({ mutateAsync: cancelMutateAsync, isPending: false }),
}));

import MyWaitlistPage from './MyWaitlistPage';

function entry(overrides: Partial<WaitlistEntry> = {}): WaitlistEntry {
  return {
    id: 31,
    schedule_id: 7,
    seat_count: 1,
    status: 'WAITING',
    position: 2,
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

function renderPage() {
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <MyWaitlistPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('MyWaitlistPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
    confirmDialogMock.mockResolvedValue(true);
  });

  it('shows an empty state', () => {
    useMyWaitlistMock.mockReturnValue({ data: { data: [], total: 0, totalPages: 1 }, isLoading: false });
    renderPage();
    expect(screen.getByText("You're not on any waitlist.")).toBeInTheDocument();
  });

  it('starts on the active entries and can show all of them', () => {
    useMyWaitlistMock.mockReturnValue({ data: { data: [], total: 0, totalPages: 1 }, isLoading: false });
    renderPage();
    expect(useMyWaitlistMock).toHaveBeenLastCalledWith(1, expect.any(Number), ['WAITING', 'NOTIFIED']);
    fireEvent.click(screen.getByRole('tab', { name: 'All' }));
    expect(useMyWaitlistMock).toHaveBeenLastCalledWith(1, expect.any(Number), undefined);
  });

  it('shows each entry with what the customer can do next', () => {
    useMyWaitlistMock.mockReturnValue({
      data: {
        data: [
          entry(),
          entry({
            id: 32,
            status: 'NOTIFIED',
            position: null,
            offered_seat_codes: ['A3'],
            expires_at: '2026-10-05T12:15:00.000Z',
          }),
          entry({ id: 33, status: 'EXPIRED', position: null, close_reason: 'OFFER_EXPIRED' }),
          entry({ id: 34, status: 'BOOKED', position: null, booking_id: 9 }),
        ],
        total: 4,
        totalPages: 1,
      },
      isLoading: false,
    });
    renderPage();

    expect(screen.getByText('#2 in line')).toBeInTheDocument();
    expect(screen.getByText(/Seat A3 reserved for you until/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Book now' })).toHaveAttribute(
      'href',
      '/BookSeat?movieId=1&day=2026-10-05&time=19%3A30',
    );
    expect(screen.getByText('The reserved seats were not booked in time.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View booking' })).toBeInTheDocument();
    expect(screen.getAllByText('Dune')).toHaveLength(4);
    // Only the active ones can be left / declined.
    expect(screen.getByRole('button', { name: 'Leave' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });

  it('leaves the queue after confirmation', async () => {
    useMyWaitlistMock.mockReturnValue({ data: { data: [entry()], total: 1, totalPages: 1 }, isLoading: false });
    cancelMutateAsync.mockResolvedValue(entry({ status: 'CANCELLED' }));
    renderPage();
    const card = screen.getByText('#2 in line').closest('div')?.parentElement as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: 'Leave' }));
    await waitFor(() => expect(cancelMutateAsync).toHaveBeenCalledWith(31));
  });
});
