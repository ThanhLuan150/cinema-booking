import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { KioskStatus } from '@/types/entities';
import { getKiosks } from '../api/kiosks.api';

export const kiosksQueryKey = ['ownerKiosks'] as const;

export function useKiosks(
  branchId: number | string | undefined,
  page: number,
  limit: number,
  filters?: { status?: KioskStatus },
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? (branchId !== undefined && branchId !== '');
  return useQuery({
    queryKey: [...kiosksQueryKey, branchId ?? 'ALL', page, limit, filters],
    queryFn: () => getKiosks(branchId, { page, limit, ...filters }),
    placeholderData: keepPreviousData,
    enabled,
  });
}
