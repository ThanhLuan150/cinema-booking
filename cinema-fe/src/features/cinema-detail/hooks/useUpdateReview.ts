import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateReview } from '../api/reviews.api';
import { cinemaReviewsQueryKey } from './useCinemaReviews';
import type { CinemaReviewUpdatePayload } from '../types/cinemaDetail.types';

export function useUpdateReview(cinemaId: string | number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, payload }: { reviewId: number; payload: CinemaReviewUpdatePayload }) =>
      updateReview(reviewId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cinemaReviewsQueryKey(cinemaId) });
    },
  });
}
