import { useMutation, useQueryClient } from '@tanstack/react-query';
import { blockGiftCard, createGiftCard } from '../api/owner.api';
import { ownerGiftCardsQueryKey } from './useOwnerGiftCards';
import type { GiftCardFormValues } from '../types/owner.types';

export function useCreateGiftCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GiftCardFormValues) =>
      createGiftCard({ ...payload, initial_balance: Number(payload.initial_balance) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerGiftCardsQueryKey }),
  });
}

export function useBlockGiftCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => blockGiftCard(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerGiftCardsQueryKey }),
  });
}
