import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteReview } from '../api/reviews.api';
import { cinemaReviewsQueryKey } from './useCinemaReviews';

export function useDeleteReview(branchId: string | number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: number) => deleteReview(reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cinemaReviewsQueryKey(branchId) });
    },
  });
}
