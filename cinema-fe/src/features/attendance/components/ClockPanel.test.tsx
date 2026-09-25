import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Attendance, AttendanceSessionState, TodayAttendance } from '@/types/entities';

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

const clockInMutate = vi.fn();
const startBreakMutate = vi.fn();
const endBreakMutate = vi.fn();
const clockOutMutate = vi.fn();
vi.mock('../hooks/useAttendanceMutations', () => ({
  useClockIn: () => ({ mutateAsync: clockInMutate, isPending: false }),
  useStartBreak: () => ({ mutateAsync: startBreakMutate, isPending: false }),
  useEndBreak: () => ({ mutateAsync: endBreakMutate, isPending: false }),
  useClockOut: () => ({ mutateAsync: clockOutMutate, isPending: false }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('@/features/notifications/toast', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

import { ClockPanel } from './ClockPanel';

const TZ = 'Asia/Ho_Chi_Minh';

function attendance(overrides: Partial<Attendance> = {}): Attendance {
  return {
    id: 1,
    employee_id: 1,
    branch_id: 1,
    work_date: '2026-09-26',
    timezone: TZ,
    shift_assignment_id: null,
    clock_in: '2026-09-26T01:00:00Z',
    clock_out: null,
    break_start: null,
    break_end: null,
    status: 'PRESENT',
    note: null,
    recorded_by: null,
    session_state: 'WORKING',
    worked_minutes: 30,
    break_minutes: 0,
    ...overrides,
  };
}

function today(state: AttendanceSessionState, record: Attendance | null = null): TodayAttendance {
  return {
    work_date: '2026-09-26',
    timezone: TZ,
    server_time: '2026-09-26T02:00:00Z',
    session_state: state,
    attendance: record,
  };
}

describe('ClockPanel', () => {
  beforeEach(() => {
    [clockInMutate, startBreakMutate, endBreakMutate, clockOutMutate, toastSuccess, toastError].forEach((m) =>
      m.mockReset().mockResolvedValue({}),
    );
  });

  it('offers only "clock in" before the day starts', () => {
    render(<ClockPanel today={today('NOT_STARTED')} />);
    expect(screen.getByRole('button', { name: 'clock.clockInAction' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'clock.clockOutAction' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'clock.breakAction' })).toBeNull();
  });

  it('clocks in with the branch timezone and confirms', async () => {
    render(<ClockPanel today={today('NOT_STARTED')} />);
    fireEvent.click(screen.getByRole('button', { name: 'clock.clockInAction' }));
    await waitFor(() => expect(clockInMutate).toHaveBeenCalledWith(TZ));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('clock.clockInSuccess'));
  });

  it('offers break and clock out while working', () => {
    render(<ClockPanel today={today('WORKING', attendance())} />);
    expect(screen.getByRole('button', { name: 'clock.breakAction' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'clock.clockOutAction' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'clock.clockInAction' })).toBeNull();
  });

  it('starts a break and clocks out with the branch timezone', async () => {
    render(<ClockPanel today={today('WORKING', attendance())} />);
    fireEvent.click(screen.getByRole('button', { name: 'clock.breakAction' }));
    await waitFor(() => expect(startBreakMutate).toHaveBeenCalledWith(TZ));
    fireEvent.click(screen.getByRole('button', { name: 'clock.clockOutAction' }));
    await waitFor(() => expect(clockOutMutate).toHaveBeenCalledWith(TZ));
  });

  it('will not offer a second break once the break has been taken', () => {
    render(
      <ClockPanel
        today={today('WORKING', attendance({ break_start: '2026-09-26T03:00:00Z', break_end: '2026-09-26T03:30:00Z' }))}
      />,
    );
    expect(screen.getByRole('button', { name: 'clock.breakAction' })).toBeDisabled();
    expect(screen.getByText('clock.breakTaken')).toBeInTheDocument();
  });

  it('while on a break only "resume" works; clock out is disabled with the reason shown', async () => {
    render(
      <ClockPanel today={today('ON_BREAK', attendance({ session_state: 'ON_BREAK', break_start: '2026-09-26T03:00:00Z' }))} />,
    );
    expect(screen.getByRole('button', { name: 'clock.clockOutAction' })).toBeDisabled();
    expect(screen.getAllByText('clock.endBreakFirst').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'clock.resumeAction' }));
    await waitFor(() => expect(endBreakMutate).toHaveBeenCalledWith(TZ));
  });

  it('shows no actions once clocked out for the day', () => {
    render(
      <ClockPanel
        today={today('CLOCKED_OUT', attendance({ session_state: 'CLOCKED_OUT', clock_out: '2026-09-26T09:00:00Z' }))}
      />,
    );
    expect(screen.getByText('clock.dayComplete')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('explains a day that was recorded as absent or on leave, and does not offer to clock in', () => {
    render(
      <ClockPanel
        today={today('NOT_STARTED', attendance({ status: 'ON_LEAVE', clock_in: null, session_state: 'NOT_STARTED' }))}
      />,
    );
    expect(screen.getByText('clock.recordedAs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'clock.clockInAction' })).toBeDisabled();
  });

  it('warns about an open session left over from an earlier day', () => {
    render(<ClockPanel today={today('WORKING', attendance({ work_date: '2026-09-10' }))} />);
    expect(screen.getByText('clock.staleSession')).toBeInTheDocument();
  });

  it('shows the error the backend returned instead of a success message', async () => {
    clockInMutate.mockRejectedValue({ response: { data: { code: 'ACTIVE_SESSION_EXISTS', message: 'You already have an active attendance session' } } });
    render(<ClockPanel today={today('NOT_STARTED')} />);
    fireEvent.click(screen.getByRole('button', { name: 'clock.clockInAction' }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
