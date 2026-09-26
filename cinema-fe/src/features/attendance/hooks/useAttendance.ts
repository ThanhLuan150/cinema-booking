import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AttendanceStatus } from '@/types/entities';
import { getAttendance, getMyAttendance, getTodayAttendance } from '../api/attendance.api';

// One prefix for everything attendance, so a realtime event (or any mutation) can invalidate the
// today-panel, the employee's history and the manager's table together.
export const attendanceQueryKey = ['attendance'] as const;

export function useTodayAttendance(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...attendanceQueryKey, 'today'],
    queryFn: getTodayAttendance,
    enabled: options?.enabled ?? true,
  });
}

export interface AttendanceListFilters {
  status?: AttendanceStatus;
  from?: string;
  to?: string;
  employeeId?: number | string;
}

export function useMyAttendance(page: number, limit: number, filters?: Omit<AttendanceListFilters, 'employeeId'>) {
  return useQuery({
    queryKey: [...attendanceQueryKey, 'mine', page, limit, filters],
    queryFn: () => getMyAttendance({ page, limit, ...filters }),
    placeholderData: keepPreviousData,
  });
}

export function useAttendanceList(
  branchId: number | string | undefined,
  page: number,
  limit: number,
  filters?: AttendanceListFilters,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...attendanceQueryKey, 'list', branchId ?? 'ALL', page, limit, filters],
    queryFn: () => getAttendance(branchId, { page, limit, ...filters }),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}
