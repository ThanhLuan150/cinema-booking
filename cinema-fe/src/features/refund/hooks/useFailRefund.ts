import { useMutation, useQueryClient } from '@tanstack/react-query';
import { failRefund } from '../api/refund.api';
import { adminRefundsQueryKey } from './useAdminRefunds';

export function useFailRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number | string; reason: string }) => failRefund(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminRefundsQueryKey }),
  });
}
