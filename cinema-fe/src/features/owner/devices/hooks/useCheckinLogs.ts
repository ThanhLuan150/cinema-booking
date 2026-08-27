import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { CheckinResult } from '@/types/entities';
import { getCheckinLogs } from '../api/devices.api';

export const checkinLogsQueryKey = ['ownerCheckinLogs'] as const;

export function useCheckinLogs(
  branchId: number | string | undefined,
  page: number,
  limit: number,
  filters?: { deviceId?: number | string; entranceId?: number | string; result?: CheckinResult },
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? (branchId !== undefined && branchId !== '');
  return useQuery({
    queryKey: [...checkinLogsQueryKey, branchId ?? 'ALL', page, limit, filters],
    queryFn: () => getCheckinLogs(branchId, { page, limit, ...filters }),
    placeholderData: keepPreviousData,
    enabled,
  });
}
