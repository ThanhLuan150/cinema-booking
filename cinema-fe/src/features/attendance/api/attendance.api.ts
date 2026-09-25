import apiClient from 'services/apiClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type { Attendance, AttendanceStatus, TodayAttendance } from '@/types/entities';

// ---- Employee self-service ---------------------------------------------------
// None of these name an employee: the backend acts on the caller's own employee record. The
// timezone we send is the branch zone /today reported; the backend re-checks it, so a stale page
// (the branch was moved to another zone) is told rather than silently booked on the wrong day.

export const getTodayAttendance = () => apiClient.get<TodayAttendance>('/attendance/today').then((res) => res.data);

export const clockIn = (timezone?: string) =>
  apiClient.post<Attendance>('/attendance/clock-in', { timezone }).then((res) => res.data);

export const startBreak = (timezone?: string) =>
  apiClient.post<Attendance>('/attendance/break/start', { timezone }).then((res) => res.data);

export const endBreak = (timezone?: string) =>
  apiClient.post<Attendance>('/attendance/break/end', { timezone }).then((res) => res.data);

export const clockOut = (timezone?: string) =>
  apiClient.post<Attendance>('/attendance/clock-out', { timezone }).then((res) => res.data);

// ---- Reading -------------------------------------------------------------------

export interface AttendanceFilters {
  status?: AttendanceStatus;
  from?: string; // YYYY-MM-DD
  to?: string;
}

// The caller's own history (attendance.read at OWN scope).
export const getMyAttendance = (params?: PaginationParams & AttendanceFilters) =>
  apiClient.get<PaginatedResponse<Attendance>>('/attendance/me', { params }).then((res) => res.data);

// Management view: a Branch Admin must pass branchId; Super Admin may omit it for every branch.
export const getAttendance = (
  branchId: number | string | undefined,
  params?: PaginationParams & AttendanceFilters & { employeeId?: number | string },
) =>
  apiClient
    .get<PaginatedResponse<Attendance>>('/attendance', { params: { branchId, ...params } })
    .then((res) => res.data);

// ---- Manager actions --------------------------------------------------------------

export interface MarkAttendancePayload {
  employee_id: number;
  work_date: string;
  status: Extract<AttendanceStatus, 'ABSENT' | 'ON_LEAVE'>;
  note?: string;
}

export const markAttendance = (payload: MarkAttendancePayload) =>
  apiClient.post<Attendance>('/attendance/mark', payload).then((res) => res.data);

export interface CloseSessionPayload {
  clock_out: string; // ISO-8601 with an explicit offset
  note: string;
}

export const closeAttendanceSession = (id: number | string, payload: CloseSessionPayload) =>
  apiClient.patch<Attendance>(`/attendance/${id}/close`, payload).then((res) => res.data);
