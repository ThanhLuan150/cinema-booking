import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateReview } from '../api/reviews.api';
import { movieReviewsQueryKey } from './useMovieReviews';
import type { MovieReviewUpdatePayload } from '../types/movieDetail.types';

export function useUpdateReview(movieId: string | number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, payload }: { reviewId: number; payload: MovieReviewUpdatePayload }) =>
      updateReview(reviewId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: movieReviewsQueryKey(movieId) });
    },
  });
}
