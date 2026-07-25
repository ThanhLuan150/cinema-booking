import { useQuery } from '@tanstack/react-query';
import { getMovieReviews } from '../api/reviews.api';

export const movieReviewsQueryKey = (movieId: string | number | undefined) =>
  ['movieReviews', movieId === undefined ? undefined : String(movieId)] as const;

export function useMovieReviews(movieId: string | number | undefined) {
  return useQuery({
    queryKey: movieReviewsQueryKey(movieId),
    queryFn: () => getMovieReviews(movieId as string | number),
    enabled: !!movieId,
  });
}
