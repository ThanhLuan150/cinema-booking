import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postMovieReview } from '../api/reviews.api';
import { movieReviewsQueryKey } from './useMovieReviews';
import type { MovieReviewPayload } from '../types/movieDetail.types';

export function usePostMovieReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MovieReviewPayload) => postMovieReview(payload),
    onSuccess: (_data, payload) => {
      queryClient.invalidateQueries({ queryKey: movieReviewsQueryKey(payload.movie_id) });
    },
  });
}
