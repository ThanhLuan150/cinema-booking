import { useQuery } from '@tanstack/react-query';
import { getOwnerVouchers } from '../api/owner.api';

export const ownerVouchersQueryKey = ['ownerVouchers'] as const;

export function useOwnerVouchers() {
  return useQuery({
    queryKey: ownerVouchersQueryKey,
    queryFn: () => getOwnerVouchers(),
  });
}
