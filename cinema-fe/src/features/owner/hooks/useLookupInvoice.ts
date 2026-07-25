import { useMutation } from '@tanstack/react-query';
import { lookupInvoiceByCode } from '../api/owner.api';

export function useLookupInvoice() {
  return useMutation({
    mutationFn: (code: string) => lookupInvoiceByCode(code),
  });
}
