import { useMutation, useQueryClient } from '@tanstack/react-query';
import { refundInvoice } from '../api/transactions.api';
import { adminInvoicesQueryKey } from './useAdminInvoices';

export function useRefundInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => refundInvoice(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminInvoicesQueryKey }),
  });
}
