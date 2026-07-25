import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postCinemaReview } from '../api/reviews.api';
import { cinemaReviewsQueryKey } from './useCinemaReviews';
import type { CinemaReviewPayload } from '../types/cinemaDetail.types';

export function usePostCinemaReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CinemaReviewPayload) => postCinemaReview(payload),
    onSuccess: (_data, payload) => {
      queryClient.invalidateQueries({ queryKey: cinemaReviewsQueryKey(payload.cinema_id) });
    },
  });
}
