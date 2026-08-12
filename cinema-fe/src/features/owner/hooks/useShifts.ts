import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getShifts } from '../api/owner.api';

export const shiftsQueryKey = ['ownerShifts'] as const;

export function useShifts(branchId: number | string | undefined, page: number, limit: number) {
  return useQuery({
    queryKey: [...shiftsQueryKey, branchId, page, limit],
    queryFn: () => getShifts(branchId as number | string, { page, limit }),
    placeholderData: keepPreviousData,
    enabled: branchId !== undefined && branchId !== '',
  });
}
