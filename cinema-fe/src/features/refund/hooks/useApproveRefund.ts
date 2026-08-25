import { useMutation, useQueryClient } from '@tanstack/react-query';
import { approveRefund } from '../api/refund.api';
import { adminRefundsQueryKey } from './useAdminRefunds';

export function useApproveRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: number | string; note?: string }) => approveRefund(id, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminRefundsQueryKey }),
  });
}
