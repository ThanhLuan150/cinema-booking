import apiClient from 'services/apiClient';
import type { User } from '@/types/entities';

export const getUsers = () => apiClient.get<User[]>('/users').then((res) => res.data);

export const getUserById = (id: number | string) => apiClient.get<User>(`/users/${id}`).then((res) => res.data);

export const blockUser = (id: number | string) => apiClient.put(`/block/${id}`);

export const unblockUser = (id: number | string, payload: { status: number }) =>
  apiClient.put(`/unblock/${id}`, payload);

export const deleteUser = (id: number | string) => apiClient.delete(`/users/${id}`);

export const updateUserRole = (id: number | string, role: number) => apiClient.put(`/users/${id}/role`, { role });

export const approveUser = (id: number | string) => apiClient.put(`/users/${id}/approve`);
