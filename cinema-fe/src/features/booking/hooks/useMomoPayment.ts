import { useMutation } from '@tanstack/react-query';
import { momoPayment } from '../api/booking.api';
import type { MomoPaymentPayload } from '../types/booking.types';

export function useMomoPayment() {
  return useMutation({
    mutationFn: (payload: MomoPaymentPayload) => momoPayment(payload),
  });
}
