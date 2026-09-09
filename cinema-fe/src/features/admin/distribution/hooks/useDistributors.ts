import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  createDistributor,
  deleteDistributor,
  getAllDistributors,
  getDistributors,
  updateDistributor,
  type DistributorFilters,
  type DistributorPayload,
} from '../api/distribution.api';
import type { DistributorStatus } from '@/types/entities';
import type { PaginationParams } from '@/types/pagination';

export const distributorsQueryKey = ['distributors'] as const;

export function useDistributors(filters: DistributorFilters = {}, pagination: PaginationParams = {}) {
  return useQuery({
    queryKey: [...distributorsQueryKey, filters, pagination],
    queryFn: () => getDistributors({ ...filters, ...pagination }),
    placeholderData: keepPreviousData,
  });
}

export function useAllDistributors(status?: DistributorStatus) {
  return useQuery({
    queryKey: [...distributorsQueryKey, 'all', status],
    queryFn: () => getAllDistributors(status),
    staleTime: 60 * 1000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: distributorsQueryKey });
}

export function useCreateDistributor() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: DistributorPayload) => createDistributor(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateDistributor() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<DistributorPayload> & { id: number | string }) =>
      updateDistributor(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteDistributor() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number | string) => deleteDistributor(id),
    onSuccess: invalidate,
  });
}
