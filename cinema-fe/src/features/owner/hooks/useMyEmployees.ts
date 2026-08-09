import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getMyEmployees } from '../api/owner.api';

export const myEmployeesQueryKey = ['myEmployees'] as const;

export function useMyEmployees(branchId: number | string | undefined, page: number, limit: number) {
  return useQuery({
    queryKey: [...myEmployeesQueryKey, branchId, page, limit],
    queryFn: () => getMyEmployees(branchId as number | string, { page, limit }),
    placeholderData: keepPreviousData,
    enabled: branchId !== undefined && branchId !== '',
  });
}
