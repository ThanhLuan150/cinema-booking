import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteReview } from '../api/reviews.api';
import { movieReviewsQueryKey } from './useMovieReviews';

export function useDeleteReview(movieId: string | number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: number) => deleteReview(reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: movieReviewsQueryKey(movieId) });
    },
  });
}
