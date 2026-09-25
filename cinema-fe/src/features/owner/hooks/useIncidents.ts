import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createIncident, getIncidents } from '../api/owner.api';

export const incidentsQueryKey = ['incidents'] as const;

export function useIncidents(branchId: number | string | undefined, page: number, limit: number) {
  return useQuery({
    queryKey: [...incidentsQueryKey, branchId, page, limit],
    queryFn: () => getIncidents(branchId as number | string, { page, limit }),
    placeholderData: keepPreviousData,
    enabled: branchId !== undefined && branchId !== '',
  });
}

export function useCreateIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createIncident,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: incidentsQueryKey }),
  });
}
