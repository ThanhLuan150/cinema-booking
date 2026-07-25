import { useMutation } from '@tanstack/react-query';
import { confirmMomoPayment } from '../api/booking.api';
import type { MomoConfirmParams } from '../types/booking.types';

export function useConfirmMomoPayment() {
  return useMutation({
    mutationFn: (payload: MomoConfirmParams) => confirmMomoPayment(payload),
  });
}
