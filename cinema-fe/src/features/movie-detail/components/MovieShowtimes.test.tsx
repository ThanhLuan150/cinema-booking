import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

const isAuthenticatedMock = vi.fn();
vi.mock('@/features/auth/hooks/useAuth', () => ({
  useIsAuthenticated: () => isAuthenticatedMock(),
}));

const schedulesMock = vi.fn();
vi.mock('@/features/booking/hooks/useBookTicketSchedules', () => ({
  useBookTicketSchedules: (...args: unknown[]) => schedulesMock(...args),
}));

import MovieShowtimes from './MovieShowtimes';

function renderSection() {
  return render(
    <MemoryRouter
      initialEntries={['/Detail/5']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/Detail/:id" element={<MovieShowtimes />} />
        <Route path="/BookSeat" element={<div>Book Seat Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MovieShowtimes', () => {
  beforeEach(() => {
    isAuthenticatedMock.mockReset();
    schedulesMock.mockReset();
    schedulesMock.mockReturnValue({ data: [], isLoading: false });
  });

  it('asks a signed-out visitor to log in instead of showing showtimes', () => {
    isAuthenticatedMock.mockReturnValue(false);
    renderSection();
    expect(screen.getByText('showtimes.loginPrompt')).toBeInTheDocument();
    expect(schedulesMock).toHaveBeenCalledWith(undefined);
  });

  it('shows an empty state when the movie has no schedules', () => {
    isAuthenticatedMock.mockReturnValue(true);
    renderSection();
    expect(screen.getByText('showtimes.empty')).toBeInTheDocument();
  });

  it('opens seat selection for the picked showtime', () => {
    isAuthenticatedMock.mockReturnValue(true);
    schedulesMock.mockReturnValue({
      data: [{ movie_date: '2099-01-01', times: ['10:00'] }],
      isLoading: false,
    });
    renderSection();
    fireEvent.click(screen.getByText('10:00'));
    expect(screen.getByText('Book Seat Page')).toBeInTheDocument();
  });
});
