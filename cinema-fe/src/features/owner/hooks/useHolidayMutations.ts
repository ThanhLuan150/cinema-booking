import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createHoliday, deleteHoliday } from '../api/owner.api';
import { ownerHolidaysQueryKey } from './useOwnerHolidays';

export function useCreateHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { date: string; name: string; branch_id: number | null }) => createHoliday(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerHolidaysQueryKey }),
  });
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteHoliday(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerHolidaysQueryKey }),
  });
}
