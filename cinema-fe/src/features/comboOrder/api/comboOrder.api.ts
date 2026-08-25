import apiClient from 'services/apiClient';
import type { PaginatedResponse } from '@/types/pagination';
import type { ComboOrder, ComboOrderListParams, CreateComboOrderPayload } from '../types/comboOrder.types';

export const getComboOrders = (params?: ComboOrderListParams) =>
  apiClient.get<PaginatedResponse<ComboOrder>>('/combo-orders', { params }).then((res) => res.data);

export const getComboOrderById = (id: number | string) =>
  apiClient.get<ComboOrder>(`/combo-orders/${id}`).then((res) => res.data);

export const createComboOrder = (payload: CreateComboOrderPayload) =>
  apiClient.post<ComboOrder>('/combo-orders', payload).then((res) => res.data);

export const payComboOrder = (id: number | string, method: 'CASH' | 'MOMO' = 'CASH') =>
  apiClient.post<ComboOrder>(`/combo-orders/${id}/pay`, { method }).then((res) => res.data);

export const prepareComboOrder = (id: number | string) =>
  apiClient.post<ComboOrder>(`/combo-orders/${id}/prepare`).then((res) => res.data);

export const readyComboOrder = (id: number | string) =>
  apiClient.post<ComboOrder>(`/combo-orders/${id}/ready`).then((res) => res.data);

export const deliverComboOrder = (id: number | string) =>
  apiClient.post<ComboOrder>(`/combo-orders/${id}/deliver`).then((res) => res.data);

export const cancelComboOrder = (id: number | string, reason?: string) =>
  apiClient.post<ComboOrder>(`/combo-orders/${id}/cancel`, { reason }).then((res) => res.data);
