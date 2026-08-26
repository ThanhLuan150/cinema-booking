import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getMaintenanceRequests } from '../api/owner.api';

export const ownerMaintenanceQueryKey = ['ownerMaintenance'] as const;

export function useOwnerMaintenance(
  branchId: number | string | undefined,
  page: number,
  limit: number,
  status?: string,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? (branchId !== undefined && branchId !== '');
  return useQuery({
    queryKey: [...ownerMaintenanceQueryKey, branchId ?? 'ALL', page, limit, status],
    queryFn: () => getMaintenanceRequests(branchId, { page, limit, status }),
    placeholderData: keepPreviousData,
    enabled,
  });
}
