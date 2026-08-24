import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getAdminPayments } from '../api/payment.api';
import type { PaymentListParams } from '../types/payment.types';

export const adminPaymentsQueryKey = ['adminPayments'] as const;

export function useAdminPayments(params: PaymentListParams) {
  return useQuery({
    queryKey: [...adminPaymentsQueryKey, params],
    queryFn: () => getAdminPayments(params),
    placeholderData: keepPreviousData,
  });
}
