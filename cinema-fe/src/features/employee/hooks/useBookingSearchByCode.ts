import { useQuery } from '@tanstack/react-query';
import { getBookings } from '@/features/booking/api/booking.api';

// Box Office "find booking" search — only fires once the cashier has typed an order code, so
// the page never pulls down the full unfiltered booking list on mount.
export function useBookingSearchByCode(code: string) {
  return useQuery({
    queryKey: ['boxOfficeBookingSearch', code],
    queryFn: () => getBookings({ code, limit: 5 }),
    enabled: code.length > 0,
  });
}
