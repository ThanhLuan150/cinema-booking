import { useMutation, useQueryClient } from '@tanstack/react-query';
import { readyComboOrder } from '../api/comboOrder.api';
import { comboOrdersQueryKey } from './useComboOrders';

export function useReadyComboOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => readyComboOrder(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: comboOrdersQueryKey }),
  });
}
