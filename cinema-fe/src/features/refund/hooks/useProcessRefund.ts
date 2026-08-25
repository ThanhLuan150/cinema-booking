import { useMutation, useQueryClient } from '@tanstack/react-query';
import { processRefund } from '../api/refund.api';
import { adminRefundsQueryKey } from './useAdminRefunds';

export function useProcessRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => processRefund(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminRefundsQueryKey }),
  });
}
