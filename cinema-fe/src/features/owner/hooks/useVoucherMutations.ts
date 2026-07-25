import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createVoucher, deleteVoucher, updateVoucher } from '../api/owner.api';
import { ownerVouchersQueryKey } from './useOwnerVouchers';
import type { VoucherFormValues } from '../types/owner.types';

export function useCreateVoucher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: VoucherFormValues) =>
      createVoucher({
        ...payload,
        discount_value: Number(payload.discount_value),
        min_order_value: Number(payload.min_order_value) || 0,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerVouchersQueryKey }),
  });
}

export function useUpdateVoucher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: number | string; active: boolean }) => updateVoucher(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerVouchersQueryKey }),
  });
}

export function useDeleteVoucher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteVoucher(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerVouchersQueryKey }),
  });
}
