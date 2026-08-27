import apiClient from 'services/apiClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type { SupportTicket, SupportTicketCategory, SupportTicketStatus } from '@/types/entities';

export const getSupportTickets = (
  branchId: number | string | undefined,
  params?: PaginationParams & { status?: SupportTicketStatus; category?: SupportTicketCategory; customerId?: number | string },
) =>
  apiClient
    .get<PaginatedResponse<SupportTicket>>('/support-tickets', { params: { branchId, ...params } })
    .then((res) => res.data);

export interface CreateSupportTicketPayload {
  branch_id: number;
  customer_id: number;
  category?: SupportTicketCategory;
  subject: string;
  description?: string;
}

export const createSupportTicket = (payload: CreateSupportTicketPayload) => apiClient.post('/support-tickets', payload);

export const updateSupportTicket = (id: number | string, payload: Record<string, unknown>) =>
  apiClient.put(`/support-tickets/${id}`, payload);

export const claimSupportTicket = (id: number | string) => apiClient.post(`/support-tickets/${id}/claim`);

export const assignSupportTicket = (id: number | string, payload: { employee_id: number }) =>
  apiClient.post(`/support-tickets/${id}/assign`, payload);

export const resolveSupportTicket = (id: number | string, payload: { resolution_note?: string }) =>
  apiClient.post(`/support-tickets/${id}/resolve`, payload);

export const closeSupportTicket = (id: number | string) => apiClient.post(`/support-tickets/${id}/close`);

export const deleteSupportTicket = (id: number | string) => apiClient.delete(`/support-tickets/${id}`);
