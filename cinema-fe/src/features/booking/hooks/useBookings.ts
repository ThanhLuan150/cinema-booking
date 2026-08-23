import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { getBookings } from '../api/booking.api';
import type { BookingListParams } from '../types/booking.types';

export const bookingsQueryKey = ['bookings'] as const;

export function useBookings(params: BookingListParams = {}) {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: [...bookingsQueryKey, params],
    queryFn: () => getBookings(params),
    enabled: isAuthenticated,
    placeholderData: keepPreviousData,
  });
}
