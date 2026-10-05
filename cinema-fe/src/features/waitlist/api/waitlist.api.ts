import apiClient from 'services/apiClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type { ShowtimeWaitlistStatus, WaitlistEntry, WaitlistStatus } from '../types/waitlist.types';

export const getMyWaitlist = (params?: PaginationParams & { status?: WaitlistStatus[] }) =>
  apiClient
    .get<PaginatedResponse<WaitlistEntry>>('/waitlist', {
      params: { ...params, status: params?.status?.length ? params.status.join(',') : undefined },
    })
    .then((res) => res.data);

export const getShowtimeWaitlist = (scheduleId: number | string) =>
  apiClient.get<ShowtimeWaitlistStatus>(`/waitlist/showtimes/${scheduleId}`).then((res) => res.data);

export const joinWaitlist = (payload: { schedule_id: number; seat_count: number }) =>
  apiClient.post<WaitlistEntry>('/waitlist', payload).then((res) => res.data);

export const cancelWaitlistEntry = (id: number | string) =>
  apiClient.post<WaitlistEntry>(`/waitlist/${id}/cancel`).then((res) => res.data);
