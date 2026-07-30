import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getAdminInvoices } from '../api/transactions.api';

export const adminInvoicesQueryKey = ['adminInvoices'] as const;

export function useAdminInvoices(page: number, limit: number) {
  return useQuery({
    queryKey: [...adminInvoicesQueryKey, page, limit],
    queryFn: () => getAdminInvoices({ page, limit }),
    placeholderData: keepPreviousData,
  });
}
