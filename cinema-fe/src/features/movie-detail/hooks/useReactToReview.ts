import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReactionType } from '@/components/reviews/reactions';
import { postReviewReaction } from '../api/reviews.api';
import { movieReviewsQueryKey } from './useMovieReviews';

export function useReactToReview(movieId: string | number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, type }: { reviewId: number; type: ReactionType }) =>
      postReviewReaction(reviewId, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: movieReviewsQueryKey(movieId) });
    },
  });
}
