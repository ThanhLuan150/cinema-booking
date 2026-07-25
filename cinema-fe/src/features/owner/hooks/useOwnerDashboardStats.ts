import { useQuery } from '@tanstack/react-query';
import { getOwnerDashboard } from '../api/owner.api';

export function useOwnerDashboardStats(cinemaId: string | undefined) {
  return useQuery({
    queryKey: ['ownerDashboardStats', cinemaId || undefined],
    queryFn: () => getOwnerDashboard(cinemaId || undefined),
  });
}
