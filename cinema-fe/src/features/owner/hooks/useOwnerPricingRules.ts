import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getOwnerPricingRules } from '../api/owner.api';

export const ownerPricingRulesQueryKey = ['ownerPricingRules'] as const;

export function useOwnerPricingRules(branchId: number | string | undefined, page: number, limit: number) {
  return useQuery({
    queryKey: [...ownerPricingRulesQueryKey, branchId, page, limit],
    queryFn: () => getOwnerPricingRules(branchId, { page, limit }),
    placeholderData: keepPreviousData,
  });
}
