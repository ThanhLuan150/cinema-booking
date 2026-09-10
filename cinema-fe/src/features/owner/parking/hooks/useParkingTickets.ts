import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { ParkingTicketStatus } from '@/types/entities';
import { getParkingTickets } from '../api/parking.api';

export const parkingTicketsQueryKey = ['ownerParkingTickets'] as const;

export function useParkingTickets(
  branchId: number | string | undefined,
  page: number,
  limit: number,
  filters?: { status?: ParkingTicketStatus; slotId?: number | string; plate?: string },
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? (branchId !== undefined && branchId !== '');
  return useQuery({
    queryKey: [...parkingTicketsQueryKey, branchId ?? 'ALL', page, limit, filters],
    queryFn: () => getParkingTickets(branchId, { page, limit, ...filters }),
    placeholderData: keepPreviousData,
    enabled,
  });
}
