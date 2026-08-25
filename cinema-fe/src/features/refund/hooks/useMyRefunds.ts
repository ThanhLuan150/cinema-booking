import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { getMyRefunds } from '../api/refund.api';

export const myRefundsQueryKey = ['myRefunds'] as const;

export function useMyRefunds(page: number, limit: number) {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: [...myRefundsQueryKey, page, limit],
    queryFn: () => getMyRefunds({ page, limit }),
    enabled: isAuthenticated,
    placeholderData: keepPreviousData,
  });
}
