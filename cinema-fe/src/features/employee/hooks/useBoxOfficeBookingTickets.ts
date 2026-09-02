import { useQuery } from '@tanstack/react-query';
import { getBoxOfficeBookingTickets } from '../api/boxOffice.api';

export function useBoxOfficeBookingTickets(bookingId: number | string | null) {
  return useQuery({
    queryKey: ['boxOfficeBookingTickets', bookingId],
    queryFn: () => getBoxOfficeBookingTickets(bookingId as number | string),
    enabled: bookingId !== null,
  });
}
