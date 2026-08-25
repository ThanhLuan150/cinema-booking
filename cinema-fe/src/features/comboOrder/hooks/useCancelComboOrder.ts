import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelComboOrder } from '../api/comboOrder.api';
import { comboOrdersQueryKey } from './useComboOrders';

export function useCancelComboOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number | string; reason?: string }) => cancelComboOrder(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: comboOrdersQueryKey }),
  });
}
