import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { getMyPointsHistory } from '../api/membership.api';

export const myPointsHistoryQueryKey = ['myPointsHistory'] as const;

export function useMyPointsHistory(page: number, limit: number) {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: [...myPointsHistoryQueryKey, page, limit],
    queryFn: () => getMyPointsHistory({ page, limit }),
    enabled: isAuthenticated,
    placeholderData: keepPreviousData,
  });
}
