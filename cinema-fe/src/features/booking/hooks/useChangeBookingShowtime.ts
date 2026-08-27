import { useMutation, useQueryClient } from '@tanstack/react-query';
import { changeBookingShowtime } from '../api/booking.api';
import { bookingsQueryKey } from './useBookings';

export function useChangeBookingShowtime() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, schedule_id, seatCodes }: { bookingId: number | string; schedule_id: number | string; seatCodes: string[] }) =>
      changeBookingShowtime(bookingId, { schedule_id, seatCodes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingsQueryKey });
    },
  });
}
