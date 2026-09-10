import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { ParkingAreaStatus } from '@/types/entities';
import { getParkingAreas } from '../api/parking.api';

export const parkingAreasQueryKey = ['ownerParkingAreas'] as const;

export function useParkingAreas(
  branchId: number | string | undefined,
  page: number,
  limit: number,
  filters?: { status?: ParkingAreaStatus },
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? (branchId !== undefined && branchId !== '');
  return useQuery({
    queryKey: [...parkingAreasQueryKey, branchId ?? 'ALL', page, limit, filters],
    queryFn: () => getParkingAreas(branchId, { page, limit, ...filters }),
    placeholderData: keepPreviousData,
    enabled,
  });
}
