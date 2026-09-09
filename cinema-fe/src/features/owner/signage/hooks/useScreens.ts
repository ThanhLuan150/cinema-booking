import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { ScreenStatus } from '@/types/entities';
import { getScreenPlayback, getScreens } from '../api/signage.api';

export const screensQueryKey = ['ownerSignageScreens'] as const;

export function useScreens(
  branchId: number | string | undefined,
  page: number,
  limit: number,
  filters?: { status?: ScreenStatus },
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? (branchId !== undefined && branchId !== '');
  return useQuery({
    queryKey: [...screensQueryKey, branchId ?? 'ALL', page, limit, filters],
    queryFn: () => getScreens(branchId, { page, limit, ...filters }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export const screenPlaybackQueryKey = ['ownerSignageScreenPlayback'] as const;

export function useScreenPlayback(screenId: number | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...screenPlaybackQueryKey, screenId],
    queryFn: () => getScreenPlayback(screenId as number),
    enabled: (options?.enabled ?? true) && screenId !== undefined,
    refetchInterval: 30_000,
  });
}
