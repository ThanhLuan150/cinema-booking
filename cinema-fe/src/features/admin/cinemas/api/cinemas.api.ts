import apiClient from 'services/apiClient';
import type { CreateBranchAdminPayload } from '../types/cinemas.types';

export const activateCinema = (id: number | string) => apiClient.put(`/cinema/${id}/activate`);

export const disableCinema = (id: number | string) => apiClient.put(`/cinema/${id}/disable`);

export const setCinemaMaintenance = (id: number | string) => apiClient.put(`/cinema/${id}/maintenance`);

export const deleteCinema = (id: number | string) => apiClient.delete(`/cinema/${id}`);

export const createBranchAdmin = (payload: CreateBranchAdminPayload) =>
  apiClient.post('/cinema/branch-admin', payload);
