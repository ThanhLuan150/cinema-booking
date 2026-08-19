import apiClient from 'services/apiClient';
import type { Director } from '@/types/entities';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type { DirectorFormValues } from '../types/director.types';

export function buildDirectorFormData(values: DirectorFormValues, avatarFile?: File | null) {
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, String(value));
  });
  if (avatarFile) formData.append('avatar_url', avatarFile);
  return formData;
}

export const getDirectors = (params?: PaginationParams) =>
  apiClient.get<PaginatedResponse<Director>>('/director', { params }).then((res) => res.data);

export const createDirector = (payload: FormData) => apiClient.post('/director', payload);

export const deleteDirector = (id: number | string) => apiClient.delete(`/director/${id}`);
