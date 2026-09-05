import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createVoucher, deleteVoucher, updateVoucher } from '../api/owner.api';
import { ownerVouchersQueryKey } from './useOwnerVouchers';
import { DISCOUNT_TYPE } from '@/constants/discountType';
import type { VoucherFormValues } from '../types/owner.types';

const FREE_TYPES: string[] = [DISCOUNT_TYPE.FREE_TICKET, DISCOUNT_TYPE.FREE_COMBO];

export function useCreateVoucher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: VoucherFormValues) => {
      const isFreeType = FREE_TYPES.includes(payload.discount_type);
      return createVoucher({
        ...payload,
        discount_value: isFreeType ? null : Number(payload.discount_value),
        free_quantity: isFreeType ? Number(payload.free_quantity) || 1 : null,
        combo_id:
          payload.discount_type === DISCOUNT_TYPE.FREE_COMBO && payload.combo_id ? Number(payload.combo_id) : null,
        min_order_value: Number(payload.min_order_value) || 0,
      });
    },
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
