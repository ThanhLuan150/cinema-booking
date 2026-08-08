import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';
import { ROLES } from '@/constants/roles';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: any) =>
        key === 'schedules.list.headers' && opts?.returnObjects
          ? ['ID', 'Movie', 'Cinema', 'Room', 'Start', 'End', 'Date', 'Price', 'Status', 'Action']
          : key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));

const useMyCinemasMock = vi.fn();
vi.mock('@/features/owner/hooks/useMyCinemas', () => ({ useMyCinemas: () => useMyCinemasMock() }));

const useAllRoomsMock = vi.fn();
vi.mock('@/features/owner/hooks/useAllRooms', () => ({ useAllRooms: () => useAllRoomsMock() }));

const useMyMoviesMock = vi.fn();
vi.mock('../../movies/hooks/useMyMovies', () => ({ useMyMovies: (...args: unknown[]) => useMyMoviesMock(...args) }));

const useSchedulesMock = vi.fn();
vi.mock('../hooks/useSchedules', () => ({ useSchedules: (...args: unknown[]) => useSchedulesMock(...args) }));

vi.mock('../components/Add', () => ({ default: () => <div>Add Schedule Modal</div> }));

import AdminSchedulesList from './List';

function renderPage(role: number | null = null) {
  const queryClient = new QueryClient();
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: { accessToken: null, userId: null, role: role == null ? null : String(role), account: null },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AdminSchedulesList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Admin Schedules List', () => {
  beforeEach(() => {
    useMyCinemasMock.mockReset();
    useAllRoomsMock.mockReset();
    useMyMoviesMock.mockReset();
    useSchedulesMock.mockReset();
    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Cinema A' }] } });
    useAllRoomsMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Room 1', cinema_id: 1 }] } });
    useMyMoviesMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Movie A' }] } });
  });

  it('renders a schedule row joined with movie/cinema/room names', () => {
    useSchedulesMock.mockReturnValue({
      data: {
        data: [
          { id: 1, movie_id: 1, room_id: 1, time_begin: '10:00', time_end: '12:00', movie_date: '2026-01-01', price: 1000, status: 'ACTIVE' },
        ],
        totalPages: 1,
      },
    });
    renderPage();
    expect(screen.getByText('Movie A')).toBeInTheDocument();
    expect(screen.getByText('Cinema A')).toBeInTheDocument();
    expect(screen.getByText('Room 1')).toBeInTheDocument();
    expect(screen.getByText('schedules.list.statusActive')).toBeInTheDocument();
  });

  it('shows a cancelled badge and no cancel button for a cancelled showtime', () => {
    useSchedulesMock.mockReturnValue({
      data: {
        data: [
          { id: 1, movie_id: 1, room_id: 1, time_begin: '10:00', time_end: '12:00', movie_date: '2026-01-01', price: 1000, status: 'CANCELLED' },
        ],
        totalPages: 1,
      },
    });
    renderPage(ROLES.admin);
    expect(screen.getByText('schedules.list.statusCancelled')).toBeInTheDocument();
    expect(screen.queryByText('schedules.list.cancelButton')).not.toBeInTheDocument();
  });

  it('shows the Add Showtime button and per-row Cancel button for a branch admin', () => {
    useSchedulesMock.mockReturnValue({
      data: {
        data: [
          { id: 1, movie_id: 1, room_id: 1, time_begin: '10:00', time_end: '12:00', movie_date: '2026-01-01', price: 1000, status: 'ACTIVE' },
        ],
        totalPages: 1,
      },
    });
    renderPage(ROLES.owner);
    expect(screen.getByText('schedules.list.addButton')).toBeInTheDocument();
    expect(screen.getByText('schedules.list.cancelButton')).toBeInTheDocument();
  });

  it('hides the Add Showtime button and per-row Cancel button for an employee', () => {
    useSchedulesMock.mockReturnValue({
      data: {
        data: [
          { id: 1, movie_id: 1, room_id: 1, time_begin: '10:00', time_end: '12:00', movie_date: '2026-01-01', price: 1000, status: 'ACTIVE' },
        ],
        totalPages: 1,
      },
    });
    renderPage(ROLES.employee);
    expect(screen.queryByText('schedules.list.addButton')).not.toBeInTheDocument();
    expect(screen.queryByText('schedules.list.cancelButton')).not.toBeInTheDocument();
  });
});
