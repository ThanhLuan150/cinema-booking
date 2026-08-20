import { useMutation } from '@tanstack/react-query';
import { releaseSeats } from '../api/booking.api';

export function useReleaseSeats(scheduleId: number | string | null) {
  return useMutation({
    mutationFn: (seatCodes: string[]) => releaseSeats(scheduleId as number | string, seatCodes),
  });
}
