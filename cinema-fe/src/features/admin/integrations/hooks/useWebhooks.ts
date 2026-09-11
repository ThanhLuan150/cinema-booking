import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { getWebhooks, retryWebhook, type WebhookFilters } from '../api/integrations.api';
import type { PaginationParams } from '@/types/pagination';

export const webhooksQueryKey = ['webhooks'] as const;

export function useWebhooks(filters: WebhookFilters = {}, pagination: PaginationParams = {}) {
  return useQuery({
    queryKey: [...webhooksQueryKey, filters, pagination],
    queryFn: () => getWebhooks({ ...filters, ...pagination }),
    placeholderData: keepPreviousData,
  });
}

export function useRetryWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => retryWebhook(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: webhooksQueryKey }),
  });
}
