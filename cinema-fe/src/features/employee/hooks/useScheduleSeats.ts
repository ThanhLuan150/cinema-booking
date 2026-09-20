import { useQuery } from '@tanstack/react-query';
import { useScheduleSeatSync } from '@/features/booking/hooks/useScheduleSeatSync';
import { getScheduleSeats } from '../api/employee.api';

// The box office grid had no refresh at all: a cashier saw the seat map as it was when they
// picked the showtime, so a seat sold online or at the next till only appeared after a reload —
// and the sale then failed on the server's lock check. The socket subscription fixes that; the
// slow poll is the fallback for a dropped connection.
const SEAT_POLL_INTERVAL_MS = 60000;

export function useScheduleSeats(scheduleId: number | string | null) {
  useScheduleSeatSync(scheduleId, ['employeeScheduleSeats', scheduleId]);

  return useQuery({
    queryKey: ['employeeScheduleSeats', scheduleId],
    queryFn: () => getScheduleSeats(scheduleId as number | string),
    enabled: !!scheduleId,
    refetchInterval: SEAT_POLL_INTERVAL_MS,
  });
}
