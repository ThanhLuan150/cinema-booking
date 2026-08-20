import { useQuery } from '@tanstack/react-query';
import { getBookedSeats } from '../api/booking.api';

const SEAT_POLL_INTERVAL_MS = 8000;

export function useBookedSeats(scheduleId: number | string | null) {
  return useQuery({
    queryKey: ['bookedSeats', scheduleId],
    queryFn: () => getBookedSeats(scheduleId as number | string),
    enabled: !!scheduleId,
    refetchInterval: SEAT_POLL_INTERVAL_MS,
  });
}
