import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPromotion, deletePromotion, updatePromotion, type PromotionPayload } from '../api/owner.api';
import { ownerPromotionsQueryKey } from './useOwnerPromotions';

export function useCreatePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PromotionPayload) => createPromotion(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerPromotionsQueryKey }),
  });
}

export function useUpdatePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: number | string } & Record<string, unknown>) =>
      updatePromotion(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerPromotionsQueryKey }),
  });
}

export function useDeletePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deletePromotion(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerPromotionsQueryKey }),
  });
}
