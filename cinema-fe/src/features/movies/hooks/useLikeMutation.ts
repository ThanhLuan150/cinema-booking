import { useMutation, useQueryClient } from '@tanstack/react-query';
import { likeMovie } from '../api/movies.api';
import type { LikePayload } from '../types/movie.types';
import { likeStatusQueryKey } from './useLikeStatus';
import { myLikedMoviesQueryKey } from './useMyLikedMovies';

export function useLikeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LikePayload) => likeMovie(payload),
    onSuccess: (_data, payload) => {
      queryClient.invalidateQueries({ queryKey: likeStatusQueryKey(payload.movie_id) });
      queryClient.invalidateQueries({ queryKey: myLikedMoviesQueryKey });
    },
  });
}
