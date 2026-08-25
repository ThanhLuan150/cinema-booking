import { useMutation, useQueryClient } from '@tanstack/react-query';
import { payComboOrder } from '../api/comboOrder.api';
import { comboOrdersQueryKey } from './useComboOrders';

export function usePayComboOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, method }: { id: number | string; method?: 'CASH' | 'MOMO' }) => payComboOrder(id, method),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: comboOrdersQueryKey }),
  });
}
