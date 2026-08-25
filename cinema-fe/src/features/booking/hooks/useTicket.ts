import { useQuery } from '@tanstack/react-query';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { getTicketById } from '../api/booking.api';

export const ticketQueryKey = (id: number | string) => ['ticket', id] as const;

export function useTicket(id: number | string | undefined) {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: ticketQueryKey(id ?? ''),
    queryFn: () => getTicketById(id as number | string),
    enabled: isAuthenticated && id !== undefined,
  });
}
