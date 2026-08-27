import apiClient from 'services/apiClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type { Notification } from '@/types/entities';

export interface NotificationFilters {
  unread?: boolean;
  status?: string;
}

export const getNotifications = (params?: PaginationParams & NotificationFilters) =>
  apiClient.get<PaginatedResponse<Notification>>('/notifications', { params }).then((res) => res.data);

export const getUnreadCount = () =>
  apiClient.get<{ count: number }>('/notifications/unread-count').then((res) => res.data.count);

export const markNotificationRead = (id: number | string) =>
  apiClient.patch<Notification>(`/notifications/${id}/read`).then((res) => res.data);

export const markAllNotificationsRead = () =>
  apiClient.patch<{ updated: number }>('/notifications/read-all').then((res) => res.data);
