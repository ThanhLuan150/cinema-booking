import apiClient from 'services/apiClient';
import type { Actor } from '@/types/entities';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type { ActorFormValues } from '../types/actor.types';

export function buildActorFormData(values: ActorFormValues, avatarFile?: File | null) {
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, String(value));
  });
  if (avatarFile) formData.append('avatar_url', avatarFile);
  return formData;
}

export const getActors = (params?: PaginationParams) =>
  apiClient.get<PaginatedResponse<Actor>>('/actor', { params }).then((res) => res.data);

export const createActor = (payload: FormData) => apiClient.post('/actor', payload);

export const deleteActor = (id: number | string) => apiClient.delete(`/actor/${id}`);
