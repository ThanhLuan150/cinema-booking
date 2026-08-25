import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { checkInInvoice, lookupInvoiceByCode, verifyTicketByQr } from '../api/employee.api';

export function useLookupInvoiceForCheckIn(code: string) {
  return useQuery({
    queryKey: ['employeeInvoiceLookup', code],
    queryFn: () => lookupInvoiceByCode(code),
    enabled: false,
    retry: false,
  });
}

export function useCheckInInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: number | string) => checkInInvoice(invoiceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employeeInvoiceLookup'] }),
  });
}

// Resolves a scanned ticket QR code to its detail, ready for confirmCheckIn via useCheckInInvoice
// (the QR view's ticket_id is the same invoice id the check-in endpoint expects).
export function useVerifyTicketByQr() {
  return useMutation({
    mutationFn: (qrToken: string) => verifyTicketByQr(qrToken),
  });
}
