import { useQuery } from '@tanstack/react-query';
import { getAdminDashboardStats } from '../api/dashboard.api';

export function useAdminDashboardStats() {
  return useQuery({
    queryKey: ['adminDashboardStats'],
    queryFn: getAdminDashboardStats,
  });
}
