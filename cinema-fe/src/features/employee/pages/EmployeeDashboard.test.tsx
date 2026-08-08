import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: { role: 3 } }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => true }) }));

const useMySchedulesMock = vi.fn();
vi.mock('../hooks/useMySchedules', () => ({ useMySchedules: (...args: unknown[]) => useMySchedulesMock(...args) }));

const useMoviesMock = vi.fn();
vi.mock('@/features/movies/hooks/useMovies', () => ({ useMovies: (...args: unknown[]) => useMoviesMock(...args) }));

const useRoomsListMock = vi.fn();
vi.mock('@/features/booking/hooks/useRoomsList', () => ({
  useRoomsList: (...args: unknown[]) => useRoomsListMock(...args),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

import EmployeeDashboard from './EmployeeDashboard';

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { placeholder: () => ({}) } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <EmployeeDashboard />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('EmployeeDashboard', () => {
  beforeEach(() => {
    useMySchedulesMock.mockReset();
    useMoviesMock.mockReset();
    useRoomsListMock.mockReset();
    navigateMock.mockReset();
    useMoviesMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Movie A' }] } });
    useRoomsListMock.mockReturnValue({ data: [{ id: 1, name: 'Room 1' }] });
  });

  it('shows an empty state when there are no showtimes today', () => {
    useMySchedulesMock.mockReturnValue({ data: { data: [] } });
    renderPage();
    expect(screen.getByText('dashboard.noShowtimesToday')).toBeInTheDocument();
  });

  it('lists only today\'s showtimes with movie/room names', () => {
    useMySchedulesMock.mockReturnValue({
      data: {
        data: [
          { id: 1, movie_id: 1, room_id: 1, movie_date: todayIso(), time_begin: '10:00', time_end: '12:00', price: 100000 },
          { id: 2, movie_id: 1, room_id: 1, movie_date: '2000-01-01', time_begin: '10:00', time_end: '12:00', price: 100000 },
        ],
      },
    });
    renderPage();
    expect(screen.getByText('Movie A')).toBeInTheDocument();
    expect(screen.getByText('Room 1')).toBeInTheDocument();
  });

  it('navigates to counter sale with the schedule id when clicking sell tickets on a row', () => {
    useMySchedulesMock.mockReturnValue({
      data: {
        data: [
          { id: 1, movie_id: 1, room_id: 1, movie_date: todayIso(), time_begin: '10:00', time_end: '12:00', price: 100000 },
        ],
      },
    });
    renderPage();
    fireEvent.click(screen.getAllByText('dashboard.sellTickets')[1]);
    expect(navigateMock).toHaveBeenCalledWith('/EmployeeCounterSale?scheduleId=1');
  });
});
