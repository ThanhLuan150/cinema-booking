import { useMutation, useQueryClient } from '@tanstack/react-query';
import { requestPaymentRefund } from '../api/payment.api';
import { adminPaymentsQueryKey } from './useAdminPayments';

export function useRequestPaymentRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number | string; reason?: string }) => requestPaymentRefund(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminPaymentsQueryKey }),
  });
}
