import { useMutation, useQueryClient } from '@tanstack/react-query';
import { prepareComboOrder } from '../api/comboOrder.api';
import { comboOrdersQueryKey } from './useComboOrders';

export function usePrepareComboOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => prepareComboOrder(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: comboOrdersQueryKey }),
  });
}
