import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getOwnerPromotions } from '../api/owner.api';

export const ownerPromotionsQueryKey = ['ownerPromotions'] as const;

export function useOwnerPromotions(branchId: number | string | undefined, page: number, limit: number) {
  return useQuery({
    queryKey: [...ownerPromotionsQueryKey, branchId, page, limit],
    queryFn: () => getOwnerPromotions(branchId, { page, limit }),
    placeholderData: keepPreviousData,
  });
}
