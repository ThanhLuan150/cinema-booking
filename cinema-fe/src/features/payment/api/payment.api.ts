import apiClient from 'services/apiClient';
import type { PaginatedResponse } from '@/types/pagination';
import type { Payment, PaymentListParams } from '../types/payment.types';

export const getMyPayments = (params?: PaymentListParams) =>
  apiClient.get<PaginatedResponse<Payment>>('/payments/my', { params }).then((res) => res.data);

export const getAdminPayments = (params?: PaymentListParams) =>
  apiClient.get<PaginatedResponse<Payment>>('/payments', { params }).then((res) => res.data);

export const getPaymentStatus = (code: string) =>
  apiClient.get<Payment>(`/payments/${code}/status`).then((res) => res.data);

export const requestPaymentRefund = (id: number | string, reason?: string) =>
  apiClient.post<Payment>(`/payments/${id}/refund/request`, { reason }).then((res) => res.data);

export const confirmPaymentRefund = (id: number | string) =>
  apiClient.post<Payment>(`/payments/${id}/refund/confirm`).then((res) => res.data);
