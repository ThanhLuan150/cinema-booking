import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

const isAuthenticatedMock = vi.fn();
vi.mock('@/features/auth/hooks/useAuth', () => ({
  useIsAuthenticated: () => isAuthenticatedMock(),
}));

const schedulesMock = vi.fn();
vi.mock('@/features/booking/hooks/useBookTicketSchedules', () => ({
  useBookTicketSchedules: () => schedulesMock(),
}));

const useMoviesMock = vi.fn();
vi.mock('@/features/movies/hooks/useMovies', () => ({ useMovies: () => useMoviesMock() }));
vi.mock('@/features/movies/hooks/useCinemasList', () => ({
  useCinemasList: () => ({ data: { data: [{ id: 7, name: 'Cinema A' }] } }),
}));

import QuickBooking from './QuickBooking';

function renderBar() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <QuickBooking />
    </MemoryRouter>,
  );
}

const openSelect = (label: string) => fireEvent.click(screen.getByLabelText(label));
const pickOption = (text: string) => fireEvent.click(screen.getByText(text));

describe('QuickBooking', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useMoviesMock.mockReset();
    schedulesMock.mockReset();
    isAuthenticatedMock.mockReturnValue(false);
    useMoviesMock.mockReturnValue({ data: { data: [{ id: 3, name: 'Movie A' }] } });
    schedulesMock.mockReturnValue({ data: [] });
  });

  it('unlocks one step at a time', () => {
    renderBar();
    expect(screen.getByLabelText('quickBooking.movie')).toBeDisabled();
    expect(screen.getByLabelText('quickBooking.date')).toBeDisabled();
    expect(screen.getByLabelText('quickBooking.time')).toBeDisabled();

    openSelect('quickBooking.cinema');
    pickOption('Cinema A');
    expect(screen.getByLabelText('quickBooking.movie')).toBeEnabled();
    expect(screen.getByLabelText('quickBooking.date')).toBeDisabled();
  });

  it('sends a signed-out visitor to the ticket page', () => {
    renderBar();
    openSelect('quickBooking.cinema');
    pickOption('Cinema A');
    openSelect('quickBooking.movie');
    pickOption('Movie A');
    fireEvent.click(screen.getByText('quickBooking.submit'));

    expect(navigateMock).toHaveBeenCalledWith('/BookTicket/3');
  });

  it('sends a signed-in visitor straight to seat selection once a showtime is picked', () => {
    isAuthenticatedMock.mockReturnValue(true);
    schedulesMock.mockReturnValue({ data: [{ movie_date: '2026-08-10', times: ['19:30'] }] });
    renderBar();

    openSelect('quickBooking.cinema');
    pickOption('Cinema A');
    openSelect('quickBooking.movie');
    pickOption('Movie A');
    openSelect('quickBooking.date');
    fireEvent.click(screen.getAllByRole('option')[1]);
    openSelect('quickBooking.time');
    pickOption('19:30');
    fireEvent.click(screen.getByText('quickBooking.submit'));

    expect(navigateMock).toHaveBeenCalledWith('/BookSeat?movieId=3&day=2026-08-10&time=19%3A30');
  });
});
