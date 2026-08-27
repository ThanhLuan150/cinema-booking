import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getAuditLogs, getAuditLogMeta, type AuditLogFilters } from '../api/auditLog.api';

export const auditLogsQueryKey = ['auditLogs'] as const;
export const auditLogMetaQueryKey = ['auditLogMeta'] as const;

export function useAuditLogs(page: number, limit: number, filters: AuditLogFilters = {}) {
  return useQuery({
    queryKey: [...auditLogsQueryKey, page, limit, filters],
    queryFn: () => getAuditLogs({ page, limit, ...filters }),
    placeholderData: keepPreviousData,
  });
}

export function useAuditLogMeta() {
  return useQuery({
    queryKey: auditLogMetaQueryKey,
    queryFn: getAuditLogMeta,
    staleTime: 5 * 60 * 1000,
  });
}
