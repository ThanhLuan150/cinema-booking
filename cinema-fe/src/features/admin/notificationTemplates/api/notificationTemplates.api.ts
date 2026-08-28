import apiClient from 'services/apiClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type {
  NotificationTemplate,
  NotificationTemplateChannel,
  NotificationTemplateEvent,
  NotificationTemplateMeta,
  NotificationTemplatePreview,
  NotificationTemplateStatus,
} from '@/types/entities';

export interface NotificationTemplateFilters {
  event?: NotificationTemplateEvent | '';
  channel?: NotificationTemplateChannel | '';
  language?: string;
  status?: NotificationTemplateStatus | '';
}

export interface NotificationTemplatePayload {
  event: NotificationTemplateEvent;
  channel: NotificationTemplateChannel;
  subject?: string;
  content: string;
  language?: string;
  status?: NotificationTemplateStatus;
  description?: string;
}

export const getNotificationTemplates = (params?: PaginationParams & NotificationTemplateFilters) =>
  apiClient
    .get<PaginatedResponse<NotificationTemplate>>('/notification-templates', { params })
    .then((res) => res.data);

export const getNotificationTemplateMeta = () =>
  apiClient.get<NotificationTemplateMeta>('/notification-templates/meta').then((res) => res.data);

export const createNotificationTemplate = (payload: NotificationTemplatePayload) =>
  apiClient.post<NotificationTemplate>('/notification-templates', payload).then((res) => res.data);

export const updateNotificationTemplate = (
  id: number | string,
  payload: Partial<NotificationTemplatePayload>,
) => apiClient.put<NotificationTemplate>(`/notification-templates/${id}`, payload).then((res) => res.data);

export const deleteNotificationTemplate = (id: number | string) =>
  apiClient.delete(`/notification-templates/${id}`);

export interface PreviewRequest {
  subject?: string;
  content: string;
  variables?: Record<string, string>;
}

export const previewNotificationTemplate = (body: PreviewRequest) =>
  apiClient
    .post<NotificationTemplatePreview>('/notification-templates/preview', body)
    .then((res) => res.data);
