import apiClient from 'services/apiClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type { AdminInvoice } from '../types/adminTransaction.types';

export const getAdminInvoices = (params?: PaginationParams) =>
  apiClient.get<PaginatedResponse<AdminInvoice>>('/admin/invoices', { params }).then((res) => res.data);

export const refundInvoice = (id: number | string) => apiClient.post(`/invoice/${id}/refund`);
