import apiClient from 'services/apiClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type {
  CheckinLog,
  CheckinResult,
  Device,
  DeviceStatus,
  DeviceWithKey,
  Entrance,
  EntranceStatus,
} from '@/types/entities';

// ---- Entrances ---------------------------------------------------------------

export const getEntrances = (
  branchId: number | string | undefined,
  params?: PaginationParams & { status?: EntranceStatus },
) =>
  apiClient
    .get<PaginatedResponse<Entrance>>('/entrance', { params: { branchId, ...params } })
    .then((res) => res.data);

export interface EntrancePayload {
  branch_id?: number;
  name?: string;
  code?: string;
  status?: EntranceStatus;
}

export const createEntrance = (payload: EntrancePayload) => apiClient.post('/entrance', payload);

export const updateEntrance = (id: number | string, payload: EntrancePayload) =>
  apiClient.put(`/entrance/${id}`, payload);

export const deleteEntrance = (id: number | string) => apiClient.delete(`/entrance/${id}`);

// ---- Devices ---------------------------------------------------------------

export const getDevices = (
  branchId: number | string | undefined,
  params?: PaginationParams & { status?: DeviceStatus; entranceId?: number | string },
) =>
  apiClient
    .get<PaginatedResponse<Device>>('/devices', { params: { branchId, ...params } })
    .then((res) => res.data);

export interface CreateDevicePayload {
  branch_id: number;
  device_id: string;
  name: string;
  entrance_id?: number | null;
  status?: DeviceStatus;
}

export const createDevice = (payload: CreateDevicePayload) =>
  apiClient.post<DeviceWithKey>('/devices', payload).then((res) => res.data);

export interface UpdateDevicePayload {
  name?: string;
  entrance_id?: number | null;
  status?: DeviceStatus;
}

export const updateDevice = (id: number | string, payload: UpdateDevicePayload) =>
  apiClient.put(`/devices/${id}`, payload);

export const rotateDeviceKey = (id: number | string) =>
  apiClient.post<{ api_key: string }>(`/devices/${id}/rotate-key`).then((res) => res.data);

export const deleteDevice = (id: number | string) => apiClient.delete(`/devices/${id}`);

// ---- Check-in logs -------------------------------------------------------------

export const getCheckinLogs = (
  branchId: number | string | undefined,
  params?: PaginationParams & { deviceId?: number | string; entranceId?: number | string; result?: CheckinResult },
) =>
  apiClient
    .get<PaginatedResponse<CheckinLog>>('/devices/logs', { params: { branchId, ...params } })
    .then((res) => res.data);
