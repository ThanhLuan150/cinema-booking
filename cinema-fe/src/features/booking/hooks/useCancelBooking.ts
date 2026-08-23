import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelBooking } from '../api/booking.api';
import { bookingsQueryKey } from './useBookings';

export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: number | string) => cancelBooking(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingsQueryKey });
    },
  });
}
