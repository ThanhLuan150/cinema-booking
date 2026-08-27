import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { DeviceStatus } from '@/types/entities';
import { getDevices } from '../api/devices.api';

export const devicesQueryKey = ['ownerDevices'] as const;

export function useDevices(
  branchId: number | string | undefined,
  page: number,
  limit: number,
  filters?: { status?: DeviceStatus; entranceId?: number | string },
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? (branchId !== undefined && branchId !== '');
  return useQuery({
    queryKey: [...devicesQueryKey, branchId ?? 'ALL', page, limit, filters],
    queryFn: () => getDevices(branchId, { page, limit, ...filters }),
    placeholderData: keepPreviousData,
    enabled,
  });
}
