import { useQuery } from '@tanstack/react-query';
import { getOwnerDashboard } from '../api/owner.api';

export function useOwnerDashboardStats(branchId: string | undefined) {
  return useQuery({
    queryKey: ['ownerDashboardStats', branchId || undefined],
    queryFn: () => getOwnerDashboard(branchId || undefined),
  });
}
