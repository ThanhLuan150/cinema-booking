import { useMutation, useQueryClient } from '@tanstack/react-query';
import { confirmPaymentRefund } from '../api/payment.api';
import { adminPaymentsQueryKey } from './useAdminPayments';

export function useConfirmPaymentRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => confirmPaymentRefund(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminPaymentsQueryKey }),
  });
}
