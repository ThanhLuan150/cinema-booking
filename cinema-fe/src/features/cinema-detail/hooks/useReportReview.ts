import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reportReview } from '../api/reviews.api';
import { cinemaReviewsQueryKey } from './useCinemaReviews';

export function useReportReview(cinemaId: string | number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, reason }: { reviewId: number; reason: string }) => reportReview(reviewId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cinemaReviewsQueryKey(cinemaId) });
    },
  });
}
