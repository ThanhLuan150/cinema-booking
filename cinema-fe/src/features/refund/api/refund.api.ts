import apiClient from 'services/apiClient';
import type { PaginatedResponse } from '@/types/pagination';
import type { Refund, RefundListParams } from '../types/refund.types';

export const requestRefund = (bookingId: number | string, reason?: string) =>
  apiClient.post<Refund>('/refunds', { booking_id: bookingId, reason }).then((res) => res.data);

export const getMyRefunds = (params?: RefundListParams) =>
  apiClient.get<PaginatedResponse<Refund>>('/refunds/my', { params }).then((res) => res.data);

export const getAdminRefunds = (params?: RefundListParams) =>
  apiClient.get<PaginatedResponse<Refund>>('/refunds', { params }).then((res) => res.data);

export const getRefundById = (id: number | string) =>
  apiClient.get<Refund>(`/refunds/${id}`).then((res) => res.data);

export const approveRefund = (id: number | string, note?: string) =>
  apiClient.post<Refund>(`/refunds/${id}/approve`, { note }).then((res) => res.data);

export const rejectRefund = (id: number | string, reason: string) =>
  apiClient.post<Refund>(`/refunds/${id}/reject`, { reason }).then((res) => res.data);

export const processRefund = (id: number | string) =>
  apiClient.post<Refund>(`/refunds/${id}/process`).then((res) => res.data);

export const completeRefund = (id: number | string) =>
  apiClient.post<Refund>(`/refunds/${id}/complete`).then((res) => res.data);

export const failRefund = (id: number | string, reason: string) =>
  apiClient.post<Refund>(`/refunds/${id}/fail`, { reason }).then((res) => res.data);
