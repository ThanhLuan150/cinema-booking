import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelSchedule } from '../api/schedules.api';
import { schedulesQueryKey } from './useSchedules';

export function useCancelSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => cancelSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schedulesQueryKey });
    },
  });
}
