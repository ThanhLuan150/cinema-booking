import apiClient from 'services/apiClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type { AuditLog, AuditLogMeta } from '@/types/entities';

export interface AuditLogFilters {
  branchId?: number | string;
  entityType?: string;
  entityId?: number | string;
  action?: string;
  performedBy?: number | string;
  from?: string;
  to?: string;
}

export const getAuditLogs = (params?: PaginationParams & AuditLogFilters) =>
  apiClient.get<PaginatedResponse<AuditLog>>('/audit-logs', { params }).then((res) => res.data);

export const getAuditLogMeta = () =>
  apiClient.get<AuditLogMeta>('/audit-logs/meta').then((res) => res.data);
