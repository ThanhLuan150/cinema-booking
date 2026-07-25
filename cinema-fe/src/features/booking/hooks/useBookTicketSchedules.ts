import { useQuery } from '@tanstack/react-query';
import { getBookTicketSchedule } from '../api/booking.api';

export function useBookTicketSchedules(movieId: string | number | undefined) {
  return useQuery({
    queryKey: ['bookTicketSchedules', movieId],
    queryFn: () => getBookTicketSchedule(movieId as string | number),
    enabled: !!movieId,
  });
}
