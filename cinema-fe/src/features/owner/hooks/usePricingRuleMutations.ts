import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPricingRule, deletePricingRule, updatePricingRule, type PricingRulePayload } from '../api/owner.api';
import { ownerPricingRulesQueryKey } from './useOwnerPricingRules';

export function useCreatePricingRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PricingRulePayload) => createPricingRule(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerPricingRulesQueryKey }),
  });
}

export function useUpdatePricingRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: number | string } & Record<string, unknown>) =>
      updatePricingRule(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerPricingRulesQueryKey }),
  });
}

export function useDeletePricingRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deletePricingRule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerPricingRulesQueryKey }),
  });
}
