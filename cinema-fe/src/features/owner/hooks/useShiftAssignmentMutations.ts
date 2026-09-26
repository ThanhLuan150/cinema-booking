import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createShiftAssignment, deleteShiftAssignment, updateShiftAssignment } from '../api/owner.api';
import { shiftAssignmentsQueryKey } from './useShiftAssignments';
import type { ShiftAssignmentFormValues } from '../types/owner.types';
import { buildAssignmentRange } from '../shifts/constants';

export function useCreateShiftAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ShiftAssignmentFormValues) =>
      createShiftAssignment({
        employee_id: Number(payload.employee_id),
        shift_id: Number(payload.shift_id),
        ...(payload.position_id ? { position_id: Number(payload.position_id) } : {}),
        date: payload.date,
        ...(payload.start_time && payload.end_time
          ? buildAssignmentRange(payload.date, payload.start_time, payload.end_time)
          : {}),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: shiftAssignmentsQueryKey }),
  });
}

export function useCancelShiftAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => updateShiftAssignment(id, { status: 'CANCELLED' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: shiftAssignmentsQueryKey }),
  });
}

export function useDeleteShiftAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteShiftAssignment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: shiftAssignmentsQueryKey }),
  });
}
