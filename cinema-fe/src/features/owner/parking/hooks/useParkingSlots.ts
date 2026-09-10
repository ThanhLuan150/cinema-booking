import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { ParkingSlotStatus, ParkingVehicleType } from '@/types/entities';
import { getParkingSlots } from '../api/parking.api';

export const parkingSlotsQueryKey = ['ownerParkingSlots'] as const;

export function useParkingSlots(
  areaId: number | string | undefined,
  page: number,
  limit: number,
  filters?: { branchId?: number | string; vehicleType?: ParkingVehicleType; status?: ParkingSlotStatus },
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? (areaId !== undefined && areaId !== '');
  return useQuery({
    queryKey: [...parkingSlotsQueryKey, areaId ?? 'ALL', page, limit, filters],
    queryFn: () => getParkingSlots(areaId, { page, limit, ...filters }),
    placeholderData: keepPreviousData,
    enabled,
  });
}
