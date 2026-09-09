import apiClient from 'services/apiClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type {
  Screen,
  ScreenStatus,
  ScreenWithKey,
  SignageContent,
  SignageContentStatus,
  SignageContentType,
  SignagePlayback,
  SignageSchedule,
  SignageScheduleStatus,
} from '@/types/entities';

// ---- Screens ---------------------------------------------------------------

export const getScreens = (
  branchId: number | string | undefined,
  params?: PaginationParams & { status?: ScreenStatus },
) =>
  apiClient
    .get<PaginatedResponse<Screen>>('/signage/screens', { params: { branchId, ...params } })
    .then((res) => res.data);

export interface ScreenPayload {
  branch_id?: number;
  name?: string;
  location?: string;
  device_id?: string;
  status?: ScreenStatus;
}

export const createScreen = (payload: ScreenPayload) =>
  apiClient.post<ScreenWithKey>('/signage/screens', payload).then((res) => res.data);

export const updateScreen = (id: number | string, payload: ScreenPayload) =>
  apiClient.put(`/signage/screens/${id}`, payload);

export const rotateScreenKey = (id: number | string) =>
  apiClient.post<{ api_key: string }>(`/signage/screens/${id}/rotate-key`).then((res) => res.data);

export const deleteScreen = (id: number | string) => apiClient.delete(`/signage/screens/${id}`);

export const getScreenPlayback = (id: number | string, at?: string) =>
  apiClient
    .get<SignagePlayback>(`/signage/screens/${id}/playback`, { params: at ? { at } : undefined })
    .then((res) => res.data);

// ---- Content -------------------------------------------------------------

export const getContents = (
  branchId: number | string | undefined,
  params?: PaginationParams & { type?: SignageContentType; status?: SignageContentStatus },
) =>
  apiClient
    .get<PaginatedResponse<SignageContent>>('/signage/contents', { params: { branchId, ...params } })
    .then((res) => res.data);

export interface ContentPayload {
  branch_id?: number;
  type?: SignageContentType;
  title?: string;
  body?: string;
  image_url?: string;
  movie_id?: number | null;
  schedule_id?: number | null;
  promotion_id?: number | null;
  status?: SignageContentStatus;
}

export const createContent = (payload: ContentPayload) =>
  apiClient.post<SignageContent>('/signage/contents', payload).then((res) => res.data);

export const updateContent = (id: number | string, payload: ContentPayload) =>
  apiClient.put(`/signage/contents/${id}`, payload);

export const deleteContent = (id: number | string) => apiClient.delete(`/signage/contents/${id}`);

// ---- Schedules (playlist entries) --------------------------------------------

export const getSignageSchedules = (
  screenId: number | string | undefined,
  params?: PaginationParams & { contentId?: number | string; status?: SignageScheduleStatus },
) =>
  apiClient
    .get<PaginatedResponse<SignageSchedule>>('/signage/schedules', { params: { screenId, ...params } })
    .then((res) => res.data);

export interface SignageSchedulePayload {
  content_id?: number;
  screen_id?: number;
  start_at?: string;
  end_at?: string;
  priority?: number;
  status?: SignageScheduleStatus;
}

export const createSignageSchedule = (payload: SignageSchedulePayload) =>
  apiClient.post<SignageSchedule>('/signage/schedules', payload).then((res) => res.data);

export const updateSignageSchedule = (id: number | string, payload: SignageSchedulePayload) =>
  apiClient.put(`/signage/schedules/${id}`, payload);

export const deleteSignageSchedule = (id: number | string) =>
  apiClient.delete(`/signage/schedules/${id}`);
