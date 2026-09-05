import { useMutation, useQueryClient } from '@tanstack/react-query';
import { redeemGiftCard } from '../api/giftCard.api';
import { myGiftCardsQueryKey } from './useMyGiftCards';

export function useRedeemGiftCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => redeemGiftCard(code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myGiftCardsQueryKey }),
  });
}
