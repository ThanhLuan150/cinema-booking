import apiClient from 'services/apiClient';
import type { Schedule } from '../types/adminSchedule.types';

export const getSchedules = () => apiClient.get<Schedule[]>('/schedule').then((res) => res.data);

export const createSchedule = (payload: Record<string, unknown>) =>
  apiClient.post<{ id: number }>('/schedule', payload);

export const createTicket = (payload: { schedule_id: number }) => apiClient.post('/ticket', payload);
