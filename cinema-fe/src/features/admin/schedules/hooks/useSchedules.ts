import { useQuery } from '@tanstack/react-query';
import { getSchedules } from '../api/schedules.api';

export const schedulesQueryKey = ['adminSchedules'] as const;

export function useSchedules() {
  return useQuery({
    queryKey: schedulesQueryKey,
    queryFn: getSchedules,
  });
}
