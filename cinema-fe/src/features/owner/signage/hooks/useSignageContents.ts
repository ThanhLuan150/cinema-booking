import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { SignageContentStatus, SignageContentType } from '@/types/entities';
import { getContents } from '../api/signage.api';

export const signageContentsQueryKey = ['ownerSignageContents'] as const;

export function useSignageContents(
  branchId: number | string | undefined,
  page: number,
  limit: number,
  filters?: { type?: SignageContentType; status?: SignageContentStatus },
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? (branchId !== undefined && branchId !== '');
  return useQuery({
    queryKey: [...signageContentsQueryKey, branchId ?? 'ALL', page, limit, filters],
    queryFn: () => getContents(branchId, { page, limit, ...filters }),
    placeholderData: keepPreviousData,
    enabled,
  });
}
