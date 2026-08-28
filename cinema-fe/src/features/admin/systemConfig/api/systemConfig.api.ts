import apiClient from 'services/apiClient';
import type {
  SystemConfigListResponse,
  SystemConfigMeta,
  SystemSettingEffective,
  SystemSettingKey,
} from '@/types/entities';

export interface SystemConfigListParams {
  /** Omit for the Global Settings view; a branch id for that branch's effective settings. */
  branchId?: number | string;
}

export const getSystemConfigMeta = () =>
  apiClient.get<SystemConfigMeta>('/system-config/meta').then((res) => res.data);

export const getSystemConfigList = (params?: SystemConfigListParams) =>
  apiClient.get<SystemConfigListResponse>('/system-config', { params }).then((res) => res.data);

export const getSystemConfigByKey = (key: SystemSettingKey, branchId?: number | string) =>
  apiClient
    .get<SystemSettingEffective>(`/system-config/${key}`, { params: branchId ? { branchId } : undefined })
    .then((res) => res.data);

export interface UpdateSystemConfigPayload {
  value: unknown;
  /** Omitted (or null) writes the Global Setting; a branch id writes that branch's override. */
  branchId?: number | null;
}

export const updateSystemConfig = (key: SystemSettingKey, payload: UpdateSystemConfigPayload) =>
  apiClient.put<SystemSettingEffective>(`/system-config/${key}`, payload).then((res) => res.data);

export const resetSystemConfig = (key: SystemSettingKey, branchId?: number | string) =>
  apiClient
    .delete<SystemSettingEffective>(`/system-config/${key}`, { params: branchId ? { branchId } : undefined })
    .then((res) => res.data);
