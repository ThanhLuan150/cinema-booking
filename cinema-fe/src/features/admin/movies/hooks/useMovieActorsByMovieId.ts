import { useQuery } from '@tanstack/react-query';
import { getMovieActorsByMovieId } from '../api/movies.api';

export function useMovieActorsByMovieId(movieId: number | string | undefined) {
  return useQuery({
    queryKey: ['movieActors', movieId],
    queryFn: () => getMovieActorsByMovieId(movieId as number | string),
    enabled: !!movieId,
  });
}
