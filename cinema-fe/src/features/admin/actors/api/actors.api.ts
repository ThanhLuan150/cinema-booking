import apiClient from 'services/apiClient';
import type { Actor } from '@/types/entities';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type { ActorFormValues } from '../types/actor.types';

export const getActors = (params?: PaginationParams) =>
  apiClient.get<PaginatedResponse<Actor>>('/actor', { params }).then((res) => res.data);

export const createActor = (payload: ActorFormValues) => apiClient.post('/actor', payload);

export const deleteActor = (id: number | string) => apiClient.delete(`/actor/${id}`);
