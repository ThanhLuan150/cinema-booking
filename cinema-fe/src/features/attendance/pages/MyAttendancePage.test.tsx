import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';

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
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => true }) }));

const useTodayMock = vi.fn();
const useMyAttendanceMock = vi.fn();
vi.mock('../hooks/useAttendance', () => ({
  useTodayAttendance: () => useTodayMock(),
  useMyAttendance: (...a: unknown[]) => useMyAttendanceMock(...a),
}));
vi.mock('../hooks/useAttendanceMutations', () => ({
  useClockIn: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useStartBreak: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useEndBreak: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useClockOut: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/features/notifications/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import MyAttendancePage from './MyAttendancePage';

function renderPage() {
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <MyAttendancePage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

const historyRow = {
  id: 7,
  employee_id: 1,
  branch_id: 1,
  work_date: '2026-09-20',
  timezone: 'Asia/Ho_Chi_Minh',
  shift_assignment_id: null,
  clock_in: '2026-09-20T01:00:00Z',
  clock_out: '2026-09-20T09:00:00Z',
  break_start: null,
  break_end: null,
  status: 'LATE',
  note: null,
  recorded_by: null,
  session_state: 'CLOCKED_OUT',
  worked_minutes: 480,
  break_minutes: 0,
};

describe('MyAttendancePage', () => {
  beforeEach(() => {
    useTodayMock.mockReset().mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        work_date: '2026-09-26',
        timezone: 'Asia/Ho_Chi_Minh',
        server_time: '2026-09-26T02:00:00Z',
        session_state: 'NOT_STARTED',
        attendance: null,
      },
    });
    useMyAttendanceMock.mockReset().mockReturnValue({ data: { data: [historyRow], totalPages: 1 } });
  });

  it('shows the clock panel and the caller’s own history', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'clock.clockInAction' })).toBeInTheDocument();
    expect(screen.getByText('2026-09-20')).toBeInTheDocument();
    expect(screen.getByText('status.LATE')).toBeInTheDocument();
    expect(screen.getByText('8h')).toBeInTheDocument();
  });

  it('does not show an employee column — the history is only ever the caller’s', () => {
    renderPage();
    expect(screen.queryByText('table.employee')).toBeNull();
  });

  it('shows an error with retry when today’s state cannot be loaded', () => {
    const refetch = vi.fn();
    useTodayMock.mockReturnValue({
      isLoading: false,
      isError: true,
      error: { response: { data: { code: 'ATTENDANCE_NOT_EMPLOYEE', message: 'Only an employee can record attendance' } } },
      data: undefined,
      refetch,
    });
    renderPage();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'clock.clockInAction' })).toBeNull();
  });

  it('shows the empty state when there is no history yet', () => {
    useMyAttendanceMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    renderPage();
    expect(screen.getByText('table.empty')).toBeInTheDocument();
  });
});
