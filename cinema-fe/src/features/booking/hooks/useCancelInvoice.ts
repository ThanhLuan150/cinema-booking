import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelInvoice } from '../api/booking.api';
import { myInvoicesQueryKey } from './useMyInvoices';

export function useCancelInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: number | string) => cancelInvoice(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myInvoicesQueryKey });
    },
  });
}
