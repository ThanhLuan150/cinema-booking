import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postMovieReply } from '../api/reviews.api';
import { movieReviewsQueryKey } from './useMovieReviews';
import type { MovieReplyPayload } from '../types/movieDetail.types';

export function usePostMovieReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MovieReplyPayload) => postMovieReply(payload),
    onSuccess: (_data, payload) => {
      queryClient.invalidateQueries({ queryKey: movieReviewsQueryKey(payload.movie_id) });
    },
  });
}
