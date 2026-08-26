import { useMutation } from '@tanstack/react-query';
import { validatePromotion } from '../api/booking.api';
import type { PromotionValidationPayload } from '../types/booking.types';

export function useValidatePromotion() {
  return useMutation({
    mutationFn: (payload: PromotionValidationPayload) => validatePromotion(payload),
  });
}
