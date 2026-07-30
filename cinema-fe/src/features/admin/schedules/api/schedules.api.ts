import apiClient from 'services/apiClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type { Schedule } from '../types/adminSchedule.types';

export interface ScheduleFilters {
  cinemaId?: string | number;
  roomId?: string | number;
}

export const getSchedules = (filters?: ScheduleFilters, pagination?: PaginationParams) =>
  apiClient
    .get<PaginatedResponse<Schedule>>('/schedule', { params: { ...filters, ...pagination } })
    .then((res) => res.data);

export const createSchedule = (payload: Record<string, unknown>) =>
  apiClient.post<{ id: number }>('/schedule', payload);

export const createTicket = (payload: { schedule_id: number }) => apiClient.post('/ticket', payload);
