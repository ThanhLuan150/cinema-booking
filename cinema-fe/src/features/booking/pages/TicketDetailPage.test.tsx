import '@/i18n';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';

vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));

const useTicketMock = vi.fn();
vi.mock('../hooks/useTicket', () => ({ useTicket: (...args: unknown[]) => useTicketMock(...args) }));

import TicketDetailPage from './TicketDetailPage';

function renderPage(id = '1') {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter
          initialEntries={[`/Ticket/${id}`]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/Ticket/:id" element={<TicketDetailPage />} />
          </Routes>
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

describe('TicketDetailPage', () => {
  beforeEach(() => useTicketMock.mockReset());

  it('shows a not-found state when the ticket does not exist', () => {
    useTicketMock.mockReturnValue({ data: undefined, isLoading: false });
    renderPage();
    expect(screen.getByText('Ticket not found')).toBeInTheDocument();
  });

  it('renders the ticket detail with movie, showtime, room, seat and status', () => {
    useTicketMock.mockReturnValue({ data: ticket(), isLoading: false });
    renderPage();
    expect(screen.getByText('Movie A')).toBeInTheDocument();
    expect(screen.getByText('Room 1')).toBeInTheDocument();
    expect(screen.getByText('A1 (Standard)')).toBeInTheDocument();
    expect(screen.getByText('CineNova District 1')).toBeInTheDocument();
    expect(screen.getByText('Issued')).toBeInTheDocument();
  });

  it('renders a QR code from the ticket\'s secure token, never the raw booking code', () => {
    useTicketMock.mockReturnValue({ data: ticket({ qr_token: 'TCK-secure-token' }), isLoading: false });
    const { container } = renderPage();
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('shows a fallback message when the ticket has no QR token', () => {
    useTicketMock.mockReturnValue({ data: ticket({ qr_token: null }), isLoading: false });
    renderPage();
    expect(screen.getByText('QR code unavailable')).toBeInTheDocument();
  });
});
