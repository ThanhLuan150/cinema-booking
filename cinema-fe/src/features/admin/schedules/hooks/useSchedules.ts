import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getSchedules, type ScheduleFilters } from '../api/schedules.api';

export const schedulesQueryKey = ['adminSchedules'] as const;

export function useSchedules(filters: ScheduleFilters, page: number, limit: number, enabled = true) {
  return useQuery({
    queryKey: [...schedulesQueryKey, filters, page, limit],
    queryFn: () => getSchedules(filters, { page, limit }),
    placeholderData: keepPreviousData,
    enabled,
  });
}
