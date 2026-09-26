import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  createSupplier,
  deleteSupplier,
  getAllSuppliers,
  getSuppliers,
  updateSupplier,
  type SupplierFilters,
  type SupplierPayload,
} from '../api/suppliers.api';
import type { SupplierStatus } from '@/types/entities';
import type { PaginationParams } from '@/types/pagination';

export const suppliersQueryKey = ['suppliers'] as const;

export function useSuppliers(filters: SupplierFilters = {}, pagination: PaginationParams = {}) {
  return useQuery({
    queryKey: [...suppliersQueryKey, filters, pagination],
    queryFn: () => getSuppliers({ ...filters, ...pagination }),
    placeholderData: keepPreviousData,
  });
}

export function useAllSuppliers(status?: SupplierStatus, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...suppliersQueryKey, 'all', status],
    queryFn: () => getAllSuppliers(status),
    staleTime: 60 * 1000,
    enabled: options?.enabled,
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: suppliersQueryKey });
}

export function useCreateSupplier() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: SupplierPayload) => createSupplier(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateSupplier() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<SupplierPayload> & { id: number | string }) =>
      updateSupplier(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteSupplier() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number | string) => deleteSupplier(id),
    onSuccess: invalidate,
  });
}
