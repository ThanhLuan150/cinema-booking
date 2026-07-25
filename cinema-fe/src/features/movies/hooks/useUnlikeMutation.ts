import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unlikeMovie } from '../api/movies.api';
import type { LikePayload } from '../types/movie.types';
import { likeStatusQueryKey } from './useLikeStatus';
import { myLikedMoviesQueryKey } from './useMyLikedMovies';

export function useUnlikeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LikePayload) => unlikeMovie(payload),
    onSuccess: (_data, payload) => {
      queryClient.invalidateQueries({ queryKey: likeStatusQueryKey(payload.movie_id) });
      queryClient.invalidateQueries({ queryKey: myLikedMoviesQueryKey });
    },
  });
}
