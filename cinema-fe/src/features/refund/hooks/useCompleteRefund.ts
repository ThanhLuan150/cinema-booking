import { useMutation, useQueryClient } from '@tanstack/react-query';
import { completeRefund } from '../api/refund.api';
import { adminRefundsQueryKey } from './useAdminRefunds';

export function useCompleteRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => completeRefund(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminRefundsQueryKey }),
  });
}
