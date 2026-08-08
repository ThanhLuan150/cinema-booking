import apiClient from 'services/apiClient';
import type { Director } from '@/types/entities';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type { DirectorFormValues } from '../types/director.types';

export const getDirectors = (params?: PaginationParams) =>
  apiClient.get<PaginatedResponse<Director>>('/director', { params }).then((res) => res.data);

export const createDirector = (payload: DirectorFormValues) => apiClient.post('/director', payload);

export const deleteDirector = (id: number | string) => apiClient.delete(`/director/${id}`);
