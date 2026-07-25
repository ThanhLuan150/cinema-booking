import apiClient from 'services/apiClient';
import type { AdminInvoice } from '../types/adminTransaction.types';

export const getAdminInvoices = () => apiClient.get<AdminInvoice[]>('/admin/invoices').then((res) => res.data);

export const refundInvoice = (id: number | string) => apiClient.post(`/invoice/${id}/refund`);
