import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  clockIn,
  clockOut,
  closeAttendanceSession,
  endBreak,
  markAttendance,
  startBreak,
  type CloseSessionPayload,
  type MarkAttendancePayload,
} from '../api/attendance.api';
import { attendanceQueryKey } from './useAttendance';

// Every attendance action changes what /today, the history and the manager's table show.
function useAttendanceMutation<TVariables, TResult>(fn: (variables: TVariables) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: attendanceQueryKey }),
  });
}

// `timezone` is the branch zone the page was showing when the button was pressed.
export const useClockIn = () => useAttendanceMutation((timezone?: string) => clockIn(timezone));
export const useStartBreak = () => useAttendanceMutation((timezone?: string) => startBreak(timezone));
export const useEndBreak = () => useAttendanceMutation((timezone?: string) => endBreak(timezone));
export const useClockOut = () => useAttendanceMutation((timezone?: string) => clockOut(timezone));

export const useMarkAttendance = () => useAttendanceMutation((payload: MarkAttendancePayload) => markAttendance(payload));

export const useCloseAttendanceSession = () =>
  useAttendanceMutation(({ id, ...payload }: CloseSessionPayload & { id: number | string }) =>
    closeAttendanceSession(id, payload),
  );
