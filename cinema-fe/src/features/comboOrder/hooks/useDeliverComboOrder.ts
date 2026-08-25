import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deliverComboOrder } from '../api/comboOrder.api';
import { comboOrdersQueryKey } from './useComboOrders';

export function useDeliverComboOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deliverComboOrder(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: comboOrdersQueryKey }),
  });
}
