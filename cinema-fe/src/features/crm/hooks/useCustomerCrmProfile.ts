import { useQuery } from '@tanstack/react-query';
import { getCustomerCrmProfile } from '../api/crm.api';

export const customerCrmProfileQueryKey = ['customerCrmProfile'] as const;

/** Staff/admin view of one customer's CRM profile. `accountId` null = disabled. */
export function useCustomerCrmProfile(accountId: number | string | null | undefined) {
  return useQuery({
    queryKey: [...customerCrmProfileQueryKey, accountId ?? null],
    queryFn: () => getCustomerCrmProfile(accountId as number | string),
    enabled: accountId != null && accountId !== '',
  });
}
