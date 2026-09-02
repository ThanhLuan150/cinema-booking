import { useQuery } from '@tanstack/react-query';
import { getOperationalReport } from '../api/reporting.api';

export const operationalReportQueryKey = ['operationalReport'] as const;

export function useOperationalReport(branchId?: number | string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...operationalReportQueryKey, branchId ?? 'auto'],
    queryFn: () => getOperationalReport({ branchId: branchId || undefined }),
    enabled: options?.enabled ?? true,
  });
}
