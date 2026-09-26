import type { AttendanceSessionState, AttendanceStatus } from '@/types/entities';

export const ALL_BRANCHES = 'ALL';

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE'];
// The two a manager may record by hand; presence and lateness come from the clock.
export const MARKABLE_STATUSES: Extract<AttendanceStatus, 'ABSENT' | 'ON_LEAVE'>[] = ['ABSENT', 'ON_LEAVE'];

export const STATUS_VARIANT: Record<AttendanceStatus, 'success' | 'warning' | 'accent' | 'default'> = {
  PRESENT: 'success',
  LATE: 'warning',
  ABSENT: 'accent',
  ON_LEAVE: 'default',
};

export const SESSION_STATE_VARIANT: Record<AttendanceSessionState, 'success' | 'warning' | 'default'> = {
  NOT_STARTED: 'default',
  WORKING: 'success',
  ON_BREAK: 'warning',
  CLOCKED_OUT: 'default',
};

export const HISTORY_PAGE_SIZE = 10;
