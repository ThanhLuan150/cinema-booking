import apiClient from 'services/apiClient';
import type { CreateBranchAdminPayload } from '../types/cinemas.types';

export const approveCinema = (id: number | string) => apiClient.put(`/cinema/${id}/approve`);

export const blockCinema = (id: number | string) => apiClient.put(`/cinema/${id}/block`);

export const deleteCinema = (id: number | string) => apiClient.delete(`/cinema/${id}`);

export const createBranchAdmin = (payload: CreateBranchAdminPayload) =>
  apiClient.post('/cinema/branch-admin', payload);
