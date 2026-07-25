import { useQuery } from '@tanstack/react-query';
import { getBookedSeats } from '../api/booking.api';

export function useBookedSeats(scheduleId: number | string | null) {
  return useQuery({
    queryKey: ['bookedSeats', scheduleId],
    queryFn: () => getBookedSeats(scheduleId as number | string),
    enabled: !!scheduleId,
  });
}
