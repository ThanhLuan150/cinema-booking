import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getUsers } from '@/features/admin/users/api/users.api';

export const customerSearchQueryKey = ['customerSearch'] as const;

// Only fires once the staff member has typed something — an empty q would otherwise return
// the entire customer base.
export function useCustomerSearch(q: string, limit = 10) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: [...customerSearchQueryKey, trimmed, limit],
    queryFn: () => getUsers({ q: trimmed, limit }),
    placeholderData: keepPreviousData,
    enabled: trimmed.length > 0,
  });
}
