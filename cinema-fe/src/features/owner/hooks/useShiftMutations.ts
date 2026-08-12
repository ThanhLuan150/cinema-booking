import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createShift, deleteShift, updateShift } from '../api/owner.api';
import { shiftsQueryKey } from './useShifts';
import type { ShiftFormValues } from '../types/owner.types';

export function useCreateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ShiftFormValues) =>
      createShift({
        branch_id: Number(payload.branch_id),
        name: payload.name,
        start_time: payload.start_time,
        end_time: payload.end_time,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: shiftsQueryKey }),
  });
}

export function useUpdateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: number | string;
      name?: string;
      start_time?: string;
      end_time?: string;
      status?: 'ACTIVE' | 'INACTIVE';
    }) => updateShift(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: shiftsQueryKey }),
  });
}

export function useDeleteShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteShift(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: shiftsQueryKey }),
  });
}
