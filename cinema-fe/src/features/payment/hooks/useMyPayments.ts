import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { getMyPayments } from '../api/payment.api';

export const myPaymentsQueryKey = ['myPayments'] as const;

export function useMyPayments(page: number, limit: number) {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: [...myPaymentsQueryKey, page, limit],
    queryFn: () => getMyPayments({ page, limit }),
    enabled: isAuthenticated,
    placeholderData: keepPreviousData,
  });
}
