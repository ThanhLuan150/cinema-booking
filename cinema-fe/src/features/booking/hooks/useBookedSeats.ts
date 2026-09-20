import { useQuery } from '@tanstack/react-query';
import { getBookedSeats } from '../api/booking.api';
import { useScheduleSeatSync } from './useScheduleSeatSync';

// The socket pushes every seat change on this showtime (hold, release, sale, refund, expiry) the
// moment it happens, so the poll is only a safety net for a dropped connection and can be slow.
const SEAT_POLL_INTERVAL_MS = 60000;

export function useBookedSeats(scheduleId: number | string | null) {
  useScheduleSeatSync(scheduleId, ['bookedSeats', scheduleId]);

  return useQuery({
    queryKey: ['bookedSeats', scheduleId],
    queryFn: () => getBookedSeats(scheduleId as number | string),
    enabled: !!scheduleId,
    refetchInterval: SEAT_POLL_INTERVAL_MS,
  });
}
