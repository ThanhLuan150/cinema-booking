import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { SupportTicketCategory, SupportTicketStatus } from '@/types/entities';
import { getSupportTickets } from '../api/customerService.api';

export const supportTicketsQueryKey = ['supportTickets'] as const;

export function useSupportTickets(
  branchId: number | string | undefined,
  page: number,
  limit: number,
  filters?: { status?: SupportTicketStatus; category?: SupportTicketCategory; customerId?: number | string },
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? (branchId !== undefined && branchId !== '');
  return useQuery({
    queryKey: [...supportTicketsQueryKey, branchId ?? 'ALL', page, limit, filters],
    queryFn: () => getSupportTickets(branchId, { page, limit, ...filters }),
    placeholderData: keepPreviousData,
    enabled,
  });
}
