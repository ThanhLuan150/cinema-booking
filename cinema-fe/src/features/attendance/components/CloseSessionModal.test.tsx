import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Attendance } from '@/types/entities';

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

const closeMutate = vi.fn();
vi.mock('../hooks/useAttendanceMutations', () => ({
  useCloseAttendanceSession: () => ({ mutateAsync: closeMutate, isPending: false }),
}));
vi.mock('@/features/notifications/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CloseSessionModal } from './CloseSessionModal';

const record: Attendance = {
  id: 42,
  employee_id: 1,
  branch_id: 1,
  work_date: '2026-09-10',
  timezone: 'Asia/Ho_Chi_Minh',
  shift_assignment_id: null,
  clock_in: '2026-09-10T01:00:00Z',
  clock_out: null,
  break_start: null,
  break_end: null,
  status: 'PRESENT',
  note: null,
  recorded_by: null,
  session_state: 'WORKING',
  worked_minutes: 0,
  break_minutes: 0,
  employee: { id: 1, employee_code: 'EMP-1', name: 'Employee One' },
};

describe('CloseSessionModal', () => {
  beforeEach(() => closeMutate.mockReset().mockResolvedValue({}));

  it('cannot be submitted without a time and a reason', () => {
    render(<CloseSessionModal record={record} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'close.submit' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('close.note'), { target: { value: 'Forgot to clock out' } });
    expect(screen.getByRole('button', { name: 'close.submit' })).toBeDisabled(); // still no time
  });

  it('names the timezone the time is to be entered in', () => {
    render(<CloseSessionModal record={record} onClose={vi.fn()} />);
    expect(screen.getByText('close.timezoneHint')).toBeInTheDocument();
    expect(screen.getByText('close.context')).toBeInTheDocument();
  });

  it('sends the clock-out with the branch zone’s offset attached', async () => {
    const onClose = vi.fn();
    render(<CloseSessionModal record={record} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('close.time'));
    fireEvent.click(await screen.findByRole('option', { name: '17:30' }));
    fireEvent.change(screen.getByLabelText('close.note'), { target: { value: '  Forgot to clock out  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'close.submit' }));

    await waitFor(() =>
      expect(closeMutate).toHaveBeenCalledWith({
        id: 42,
        clock_out: '2026-09-10T17:30:00+07:00',
        note: 'Forgot to clock out',
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
