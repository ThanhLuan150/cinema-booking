import { useMutation, useQueryClient } from '@tanstack/react-query';
import { respondToReschedule } from '../api/booking.api';
import { bookingsQueryKey } from './useBookings';

export function useRespondToReschedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, action }: { bookingId: number | string; action: 'ACCEPT' | 'REFUND' }) =>
      respondToReschedule(bookingId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingsQueryKey });
    },
  });
}
