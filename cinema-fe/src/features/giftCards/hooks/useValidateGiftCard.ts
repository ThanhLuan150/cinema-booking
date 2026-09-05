import { useMutation } from '@tanstack/react-query';
import { validateGiftCard } from '../api/giftCard.api';

export function useValidateGiftCard() {
  return useMutation({
    mutationFn: ({ code, orderValue }: { code: string; orderValue: number }) => validateGiftCard(code, orderValue),
  });
}
