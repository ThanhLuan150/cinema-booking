import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { SignageScheduleStatus } from '@/types/entities';
import { getSignageSchedules } from '../api/signage.api';

export const signageSchedulesQueryKey = ['ownerSignageSchedules'] as const;

export function useSignageSchedules(
  screenId: number | string | undefined,
  page: number,
  limit: number,
  filters?: { contentId?: number | string; status?: SignageScheduleStatus },
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? (screenId !== undefined && screenId !== '');
  return useQuery({
    queryKey: [...signageSchedulesQueryKey, screenId ?? 'NONE', page, limit, filters],
    queryFn: () => getSignageSchedules(screenId, { page, limit, ...filters }),
    placeholderData: keepPreviousData,
    enabled,
  });
}
