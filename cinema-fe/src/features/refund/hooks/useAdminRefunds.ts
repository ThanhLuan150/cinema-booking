import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getAdminRefunds } from '../api/refund.api';
import type { RefundListParams } from '../types/refund.types';

export const adminRefundsQueryKey = ['adminRefunds'] as const;

export function useAdminRefunds(params: RefundListParams) {
  return useQuery({
    queryKey: [...adminRefundsQueryKey, params],
    queryFn: () => getAdminRefunds(params),
    placeholderData: keepPreviousData,
  });
}
