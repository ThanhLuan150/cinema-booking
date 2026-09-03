import apiClient from 'services/apiClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type { Kiosk, KioskStatus, KioskWithKey } from '@/types/entities';

export const getKiosks = (
  branchId: number | string | undefined,
  params?: PaginationParams & { status?: KioskStatus },
) =>
  apiClient
    .get<PaginatedResponse<Kiosk>>('/kiosks', { params: { branchId, ...params } })
    .then((res) => res.data);

export interface CreateKioskPayload {
  branch_id: number;
  kiosk_code: string;
  name: string;
  status?: KioskStatus;
}

export const createKiosk = (payload: CreateKioskPayload) =>
  apiClient.post<KioskWithKey>('/kiosks', payload).then((res) => res.data);

export interface UpdateKioskPayload {
  name?: string;
  status?: KioskStatus;
}

export const updateKiosk = (id: number | string, payload: UpdateKioskPayload) =>
  apiClient.put(`/kiosks/${id}`, payload);

export const rotateKioskKey = (id: number | string) =>
  apiClient.post<{ api_key: string }>(`/kiosks/${id}/rotate-key`).then((res) => res.data);

export const deleteKiosk = (id: number | string) => apiClient.delete(`/kiosks/${id}`);
