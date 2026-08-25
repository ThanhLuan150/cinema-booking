import { useQuery } from '@tanstack/react-query';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { getMyTickets } from '../api/booking.api';

export const myTicketsQueryKey = ['myTickets'] as const;

export function useMyTickets() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: myTicketsQueryKey,
    queryFn: getMyTickets,
    enabled: isAuthenticated,
  });
}
