import { useQuery } from '@tanstack/react-query';
import { getCinemaReviews } from '../api/reviews.api';

export const cinemaReviewsQueryKey = (branchId: string | number | undefined) =>
  ['cinemaReviews', branchId === undefined ? undefined : String(branchId)] as const;

export function useCinemaReviews(branchId: string | number | undefined) {
  return useQuery({
    queryKey: cinemaReviewsQueryKey(branchId),
    queryFn: () => getCinemaReviews(branchId as string | number),
    enabled: !!branchId,
  });
}
