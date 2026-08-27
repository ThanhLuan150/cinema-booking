import apiClient from 'services/apiClient';
import type { User } from '@/types/entities';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';

// q searches name/email/phone — used both by the admin Users list and by Customer Service's
// customer lookup.
export const getUsers = (params?: PaginationParams & { q?: string }) =>
  apiClient.get<PaginatedResponse<User>>('/users', { params }).then((res) => res.data);

export const getUserById = (id: number | string) => apiClient.get<User>(`/users/${id}`).then((res) => res.data);

export const blockUser = (id: number | string) => apiClient.put(`/block/${id}`);

export const unblockUser = (id: number | string, payload: { status: number }) =>
  apiClient.put(`/unblock/${id}`, payload);

export const deleteUser = (id: number | string) => apiClient.delete(`/users/${id}`);

export const approveUser = (id: number | string) => apiClient.put(`/users/${id}/approve`);
