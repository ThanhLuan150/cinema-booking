import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  getNotificationTemplates,
  getNotificationTemplateMeta,
  type NotificationTemplateFilters,
} from '../api/notificationTemplates.api';

export const notificationTemplatesQueryKey = ['notificationTemplates'] as const;
export const notificationTemplateMetaQueryKey = ['notificationTemplateMeta'] as const;

export function useNotificationTemplates(
  page: number,
  limit: number,
  filters: NotificationTemplateFilters = {},
) {
  return useQuery({
    queryKey: [...notificationTemplatesQueryKey, page, limit, filters],
    queryFn: () => getNotificationTemplates({ page, limit, ...filters }),
    placeholderData: keepPreviousData,
  });
}

export function useNotificationTemplateMeta() {
  return useQuery({
    queryKey: notificationTemplateMetaQueryKey,
    queryFn: getNotificationTemplateMeta,
    staleTime: 5 * 60 * 1000,
  });
}
