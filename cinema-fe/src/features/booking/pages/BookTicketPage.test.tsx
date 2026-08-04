import '@/i18n';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer, { login } from '@/features/auth/store/authSlice';
import bookingReducer from '../store/bookingSlice';
import type { Account } from '@/types/entities';

const useBookTicketSchedulesMock = vi.fn();
vi.mock('../hooks/useBookTicketSchedules', () => ({
  useBookTicketSchedules: (...args: unknown[]) => useBookTicketSchedulesMock(...args),
}));

vi.mock('@/features/movies/hooks/useMovieDetail', () => ({
  useMovieDetail: () => ({ data: { id: 5, name: 'Movie A' } }),
}));

vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));

import BookTicketPage from './BookTicketPage';

function renderPage(entry = '/BookTicket/5') {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer, booking: bookingReducer } });
  store.dispatch(login({ accessToken: 'tok', userId: '1', role: '1', account: {} as Account }));
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/BookTicket/:id" element={<BookTicketPage />} />
            <Route path="/BookSeat" element={<div>Book Seat Page</div>} />
          </Routes>
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('BookTicketPage', () => {
  beforeEach(() => useBookTicketSchedulesMock.mockReset());

  it('shows an empty state when there are no schedules', () => {
    useBookTicketSchedulesMock.mockReturnValue({ data: [], isLoading: false });
    renderPage();
    expect(screen.getByText('No showtimes available')).toBeInTheDocument();
  });

  it('renders dates and times for the movie', () => {
    useBookTicketSchedulesMock.mockReturnValue({
      data: [{ movie_date: '2099-01-01', times: ['10:00', '14:00'] }],
      isLoading: false,
    });
    renderPage();
    // The date chip shows a localised weekday + day/month instead of the raw ISO date.
    expect(screen.getByText('01/01')).toBeInTheDocument();
    expect(screen.getByText('10:00')).toBeInTheDocument();
  });

  it('navigates to BookSeat with the selected date/time', () => {
    useBookTicketSchedulesMock.mockReturnValue({
      data: [{ movie_date: '2099-01-01', times: ['10:00'] }],
      isLoading: false,
    });
    renderPage();
    fireEvent.click(screen.getByText('10:00'));
    fireEvent.click(screen.getByText('Book'));
    expect(screen.getByText('Book Seat Page')).toBeInTheDocument();
  });
});
