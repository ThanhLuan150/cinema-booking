import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  createIntegration,
  deleteIntegration,
  getIntegrations,
  updateIntegration,
  type IntegrationFilters,
  type IntegrationPayload,
} from '../api/integrations.api';
import type { PaginationParams } from '@/types/pagination';

export const integrationsQueryKey = ['integrations'] as const;

export function useIntegrations(filters: IntegrationFilters = {}, pagination: PaginationParams = {}) {
  return useQuery({
    queryKey: [...integrationsQueryKey, filters, pagination],
    queryFn: () => getIntegrations({ ...filters, ...pagination }),
    placeholderData: keepPreviousData,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: integrationsQueryKey });
}

export function useCreateIntegration() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: IntegrationPayload) => createIntegration(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateIntegration() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<IntegrationPayload> & { id: number | string }) =>
      updateIntegration(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteIntegration() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number | string) => deleteIntegration(id),
    onSuccess: invalidate,
  });
}
