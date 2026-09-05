import { useMutation } from '@tanstack/react-query';
import { payWithGiftCard } from '../api/giftCard.api';
import type { PayWithGiftCardPayload } from '../types/giftCard.types';

export function usePayWithGiftCard() {
  return useMutation({
    mutationFn: ({ payload, idempotencyKey }: { payload: PayWithGiftCardPayload; idempotencyKey?: string }) =>
      payWithGiftCard(payload, idempotencyKey),
  });
}
