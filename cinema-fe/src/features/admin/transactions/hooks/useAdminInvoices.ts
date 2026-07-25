import { useQuery } from '@tanstack/react-query';
import { getAdminInvoices } from '../api/transactions.api';

export const adminInvoicesQueryKey = ['adminInvoices'] as const;

export function useAdminInvoices() {
  return useQuery({
    queryKey: adminInvoicesQueryKey,
    queryFn: getAdminInvoices,
  });
}
