import { useQuery } from '@tanstack/react-query';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { getMyInvoices } from '../api/booking.api';

export const myInvoicesQueryKey = ['myInvoices'] as const;

export function useMyInvoices() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: myInvoicesQueryKey,
    queryFn: getMyInvoices,
    enabled: isAuthenticated,
  });
}
