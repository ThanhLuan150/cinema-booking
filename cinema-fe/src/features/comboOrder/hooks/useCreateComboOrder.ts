import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createComboOrder } from '../api/comboOrder.api';
import { comboOrdersQueryKey } from './useComboOrders';
import type { CreateComboOrderPayload } from '../types/comboOrder.types';

export function useCreateComboOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateComboOrderPayload) => createComboOrder(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: comboOrdersQueryKey }),
  });
}
