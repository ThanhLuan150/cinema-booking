import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getOwnerVouchers } from '../api/owner.api';

export const ownerVouchersQueryKey = ['ownerVouchers'] as const;

export function useOwnerVouchers(page: number, limit: number) {
  return useQuery({
    queryKey: [...ownerVouchersQueryKey, page, limit],
    queryFn: () => getOwnerVouchers(undefined, { page, limit }),
    placeholderData: keepPreviousData,
  });
}
