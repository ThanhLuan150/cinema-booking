import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postCinemaReply } from '../api/reviews.api';
import { cinemaReviewsQueryKey } from './useCinemaReviews';
import type { CinemaReplyPayload } from '../types/cinemaDetail.types';

export function usePostCinemaReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CinemaReplyPayload) => postCinemaReply(payload),
    onSuccess: (_data, payload) => {
      queryClient.invalidateQueries({ queryKey: cinemaReviewsQueryKey(payload.cinema_id) });
    },
  });
}
