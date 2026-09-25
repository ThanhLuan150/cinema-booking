import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
      t: (key: string) => key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});

let role: number = ROLES.owner;
vi.mock('@/features/auth/hooks/useAuth', () => ({ useAuthRole: () => role }));
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: { cinema_id: 1 } }) }));

const hasPermissionMock = vi.fn();
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: hasPermissionMock }) }));

vi.mock('@/features/owner/hooks/useMyCinemas', () => ({
  useMyCinemas: () => ({ data: { data: [{ id: 1, name: 'Branch A' }] } }),
}));
const useMyEmployeesMock = vi.fn();
vi.mock('@/features/owner/hooks/useMyEmployees', () => ({
  useMyEmployees: (...a: unknown[]) => useMyEmployeesMock(...a),
}));

const useAttendanceListMock = vi.fn();
vi.mock('../hooks/useAttendance', () => ({
  useAttendanceList: (...a: unknown[]) => useAttendanceListMock(...a),
}));
vi.mock('../hooks/useAttendanceMutations', () => ({
  useMarkAttendance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCloseAttendanceSession: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/features/notifications/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AttendanceManagementPage from './AttendanceManagementPage';

function renderPage() {
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AttendanceManagementPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    employee_id: 1,
    branch_id: 1,
    work_date: '2026-09-20',
    timezone: 'Asia/Ho_Chi_Minh',
    shift_assignment_id: null,
    clock_in: '2026-09-20T01:00:00Z',
    clock_out: '2026-09-20T09:00:00Z',
    break_start: null,
    break_end: null,
    status: 'PRESENT',
    note: null,
    recorded_by: null,
    session_state: 'CLOCKED_OUT',
    worked_minutes: 480,
    break_minutes: 0,
    employee: { id: 1, employee_code: 'EMP-1', name: 'Employee One' },
    ...overrides,
  };
}

// The list hook's args: (branchId, page, limit, filters, options)
const lastListCall = () => useAttendanceListMock.mock.calls[useAttendanceListMock.mock.calls.length - 1];

describe('AttendanceManagementPage', () => {
  beforeEach(() => {
    role = ROLES.owner;
    hasPermissionMock.mockReset().mockReturnValue(true);
    useMyEmployeesMock.mockReset().mockReturnValue({
      data: { data: [{ id: 1, employee_code: 'EMP-1', name: 'Employee One', status: 1 }] },
    });
    useAttendanceListMock
      .mockReset()
      .mockReturnValue({ data: { data: [row()], totalPages: 1 }, isLoading: false, isError: false });
  });

  it('lists the branch’s attendance with the employee named', () => {
    renderPage();
    expect(screen.getByText('Employee One')).toBeInTheDocument();
    expect(screen.getByText('EMP-1')).toBeInTheDocument();
    expect(screen.getByText('status.PRESENT')).toBeInTheDocument();
  });

  it('defaults a branch admin to their own branch and holds the query until it is known', () => {
    renderPage();
    const [branchId, page, , , options] = lastListCall();
    expect(branchId).toBe('1');
    expect(page).toBe(1);
    expect(options).toEqual({ enabled: true });
  });

  it('defaults the super admin to every branch (no branchId) and shows the branch column', () => {
    role = ROLES.admin;
    useAttendanceListMock.mockReturnValue({
      data: { data: [row({ branch_id: 2 })], totalPages: 1 },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(lastListCall()[0]).toBeUndefined();
    expect(screen.getByText('table.branch')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('shows the manage actions only with attendance.manage', () => {
    useAttendanceListMock.mockReturnValue({
      data: { data: [row({ session_state: 'WORKING', clock_out: null })], totalPages: 1 },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByRole('button', { name: 'admin.markAbsence' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'table.closeSession' })).toBeInTheDocument();
  });

  it('hides the manage actions without attendance.manage', () => {
    hasPermissionMock.mockImplementation((code: string) => code !== 'attendance.manage');
    useAttendanceListMock.mockReturnValue({
      data: { data: [row({ session_state: 'WORKING', clock_out: null })], totalPages: 1 },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.queryByRole('button', { name: 'admin.markAbsence' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'table.closeSession' })).toBeNull();
  });

  it('only offers to close a session that is still open', () => {
    renderPage(); // the default row is clocked out
    expect(screen.queryByRole('button', { name: 'table.closeSession' })).toBeNull();
  });

  it('opens the close-session dialog for an open row', async () => {
    useAttendanceListMock.mockReturnValue({
      data: { data: [row({ session_state: 'WORKING', clock_out: null })], totalPages: 1 },
      isLoading: false,
      isError: false,
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'table.closeSession' }));
    expect(await screen.findByText('close.title')).toBeInTheDocument();
  });

  it('opens the mark-absence dialog listing the branch’s active employees', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'admin.markAbsence' }));
    expect(await screen.findByText('mark.title')).toBeInTheDocument();
  });

  it('shows the backend error rather than an empty table when the list fails', () => {
    useAttendanceListMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { response: { data: { code: 'INVALID_DATE', message: 'from must be a valid YYYY-MM-DD date' } } },
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('table.empty')).toBeNull();
  });

  it('passes a status filter through and returns to page one', async () => {
    renderPage();
    fireEvent.click(screen.getByText('admin.allStatuses'));
    fireEvent.click(await screen.findByRole('option', { name: 'status.LATE' }));
    await waitFor(() => expect(lastListCall()[3]).toMatchObject({ status: 'LATE' }));
    expect(lastListCall()[1]).toBe(1);
  });
});
