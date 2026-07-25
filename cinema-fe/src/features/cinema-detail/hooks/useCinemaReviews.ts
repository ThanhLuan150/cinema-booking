import { useQuery } from '@tanstack/react-query';
import { getCinemaReviews } from '../api/reviews.api';

export const cinemaReviewsQueryKey = (cinemaId: string | number | undefined) =>
  ['cinemaReviews', cinemaId === undefined ? undefined : String(cinemaId)] as const;

export function useCinemaReviews(cinemaId: string | number | undefined) {
  return useQuery({
    queryKey: cinemaReviewsQueryKey(cinemaId),
    queryFn: () => getCinemaReviews(cinemaId as string | number),
    enabled: !!cinemaId,
  });
}
