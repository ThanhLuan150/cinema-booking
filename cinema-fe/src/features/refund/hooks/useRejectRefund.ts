import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rejectRefund } from '../api/refund.api';
import { adminRefundsQueryKey } from './useAdminRefunds';

export function useRejectRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number | string; reason: string }) => rejectRefund(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminRefundsQueryKey }),
  });
}
