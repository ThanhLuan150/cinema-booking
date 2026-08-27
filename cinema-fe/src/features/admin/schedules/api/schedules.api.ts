import apiClient from 'services/apiClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type { Schedule } from '../types/adminSchedule.types';

export interface ScheduleFilters {
  branchId?: string | number;
  roomId?: string | number;
  movieId?: string | number;
}

export const getSchedules = (filters?: ScheduleFilters, pagination?: PaginationParams) =>
  apiClient
    .get<PaginatedResponse<Schedule>>('/schedule', { params: { ...filters, ...pagination } })
    .then((res) => res.data);

export const createSchedule = (payload: Record<string, unknown>) =>
  apiClient.post<{ id: number }>('/schedule', payload);

export const cancelSchedule = (id: number | string) => apiClient.patch<Schedule>(`/schedule/${id}/cancel`);

export interface RescheduleSchedulePayload {
  movie_date: string;
  time_begin: string;
  time_end: string;
}

export const rescheduleSchedule = (id: number | string, payload: RescheduleSchedulePayload) =>
  apiClient.patch<Schedule>(`/schedule/${id}/reschedule`, payload);

export const createTicket = (payload: { schedule_id: number }) => apiClient.post('/ticket', payload);
