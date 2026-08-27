import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { EntranceStatus } from '@/types/entities';
import { getEntrances } from '../api/devices.api';

export const entrancesQueryKey = ['ownerEntrances'] as const;

export function useEntrances(
  branchId: number | string | undefined,
  page: number,
  limit: number,
  filters?: { status?: EntranceStatus },
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? (branchId !== undefined && branchId !== '');
  return useQuery({
    queryKey: [...entrancesQueryKey, branchId ?? 'ALL', page, limit, filters],
    queryFn: () => getEntrances(branchId, { page, limit, ...filters }),
    placeholderData: keepPreviousData,
    enabled,
  });
}
