import { useQuery } from '@tanstack/react-query';
import { getEligibleBookings } from '../api/reviews.api';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';

export const eligibleBookingsQueryKey = (movieId: string | number | undefined) =>
  ['movieReviewEligibleBookings', movieId === undefined ? undefined : String(movieId)] as const;

// Ticket 33: which of the caller's bookings for this movie satisfy Payment=PAID + Ticket=USED
// and haven't been reviewed yet. Drives whether the "write a review" form is shown at all.
export function useEligibleBookings(movieId: string | number | undefined) {
  const isLoggedIn = useIsAuthenticated();
  return useQuery({
    queryKey: eligibleBookingsQueryKey(movieId),
    queryFn: () => getEligibleBookings(movieId as string | number),
    enabled: !!movieId && isLoggedIn,
  });
}
