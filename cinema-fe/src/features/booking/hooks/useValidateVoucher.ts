import { useMutation } from '@tanstack/react-query';
import { validateVoucher } from '../api/booking.api';
import type { VoucherValidationPayload } from '../types/booking.types';

export function useValidateVoucher() {
  return useMutation({
    mutationFn: (payload: VoucherValidationPayload) => validateVoucher(payload),
  });
}
