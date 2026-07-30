import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReactionType } from '@/components/reviews/reactions';
import { postReviewReaction } from '../api/reviews.api';
import { cinemaReviewsQueryKey } from './useCinemaReviews';

export function useReactToCinemaReview(cinemaId: string | number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, type }: { reviewId: number; type: ReactionType }) => postReviewReaction(reviewId, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cinemaReviewsQueryKey(cinemaId) });
    },
  });
}
