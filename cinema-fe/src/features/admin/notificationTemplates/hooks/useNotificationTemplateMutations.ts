import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createNotificationTemplate,
  deleteNotificationTemplate,
  updateNotificationTemplate,
  type NotificationTemplatePayload,
} from '../api/notificationTemplates.api';
import { notificationTemplatesQueryKey } from './useNotificationTemplates';

type QC = ReturnType<typeof useQueryClient>;
const invalidate = (qc: QC) => qc.invalidateQueries({ queryKey: notificationTemplatesQueryKey });

export function useCreateNotificationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: NotificationTemplatePayload) => createNotificationTemplate(payload),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateNotificationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<NotificationTemplatePayload> & { id: number | string }) =>
      updateNotificationTemplate(id, payload),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteNotificationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteNotificationTemplate(id),
    onSuccess: () => invalidate(qc),
  });
}
