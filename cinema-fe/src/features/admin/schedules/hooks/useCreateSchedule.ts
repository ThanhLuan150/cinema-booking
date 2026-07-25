import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createSchedule, createTicket } from '../api/schedules.api';
import { schedulesQueryKey } from './useSchedules';
import type { ScheduleFormValues } from '../types/adminSchedule.types';

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ movieId, values }: { movieId: number | string; values: ScheduleFormValues }) => {
      const response = await createSchedule({ movie_id: movieId, ...values });
      await createTicket({ schedule_id: response.data.id });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schedulesQueryKey });
    },
  });
}
