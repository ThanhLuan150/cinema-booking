import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rescheduleSchedule, type RescheduleSchedulePayload } from '../api/schedules.api';
import { schedulesQueryKey } from './useSchedules';

export function useRescheduleSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number | string; payload: RescheduleSchedulePayload }) =>
      rescheduleSchedule(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schedulesQueryKey });
    },
  });
}
