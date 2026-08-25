import '@/i18n';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';

vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));

const useMyTicketsMock = vi.fn();
vi.mock('../hooks/useMyTickets', () => ({ useMyTickets: () => useMyTicketsMock() }));

import MyTicketsPage from './MyTicketsPage';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <MyTicketsPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    ticket_id: 1,
    booking_id: 9,
    code: 'BK-1',
    status: 'ISSUED',
    checked_in: false,
    qr_token: 'TCK-1',
    issued_at: '2026-01-01T08:00:00.000Z',
    total_price: 100000,
    seat_code: 'A1',
    seat_type: 0,
    movie: { id: 1, name: 'Movie A', avatar: '' },
    schedule: { id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00' },
    room: { id: 1, name: 'Room 1', type: '2D' },
    branch: { id: 1, name: 'CineNova District 1', address: '', city: '' },
    ...overrides,
  };
}

describe('MyTicketsPage', () => {
  beforeEach(() => useMyTicketsMock.mockReset());

  it('shows an empty state when there are no tickets', () => {
    useMyTicketsMock.mockReturnValue({ data: [], isLoading: false });
    renderPage();
    expect(screen.getByText('You have no e-tickets yet')).toBeInTheDocument();
  });

  it('renders a ticket card with movie, showtime, seat and status, linking to its detail page', () => {
    useMyTicketsMock.mockReturnValue({ data: [ticket()], isLoading: false });
    renderPage();
    expect(screen.getByText('Movie A')).toBeInTheDocument();
    expect(screen.getByText('Seat: A1 (Standard) · Room 1')).toBeInTheDocument();
    expect(screen.getByText('Issued')).toBeInTheDocument();
    const link = screen.getByText('Movie A').closest('a');
    expect(link).toHaveAttribute('href', '/Ticket/1');
  });

  it('reflects a USED ticket status', () => {
    useMyTicketsMock.mockReturnValue({ data: [ticket({ status: 'USED', checked_in: true })], isLoading: false });
    renderPage();
    expect(screen.getByText('Used')).toBeInTheDocument();
  });
});
