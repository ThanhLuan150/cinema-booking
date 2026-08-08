import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { checkInInvoice, lookupInvoiceByCode } from '../api/employee.api';

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
