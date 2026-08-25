import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingsQueryKey } from '@/features/booking/hooks/useBookings';
import { requestRefund } from '../api/refund.api';
import { myRefundsQueryKey } from './useMyRefunds';

export function useRequestRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: number | string; reason?: string }) =>
      requestRefund(bookingId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myRefundsQueryKey });
      queryClient.invalidateQueries({ queryKey: bookingsQueryKey });
    },
  });
}
