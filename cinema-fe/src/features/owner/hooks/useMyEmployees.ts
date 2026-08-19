import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getMyEmployees } from '../api/owner.api';

export const myEmployeesQueryKey = ['myEmployees'] as const;

export function useMyEmployees(
  branchId: number | string | undefined,
  page: number,
  limit: number,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? (branchId !== undefined && branchId !== '');
  return useQuery({
    queryKey: [...myEmployeesQueryKey, branchId ?? 'ALL', page, limit],
    queryFn: () => getMyEmployees(branchId, { page, limit }),
    placeholderData: keepPreviousData,
    enabled,
  });
}
