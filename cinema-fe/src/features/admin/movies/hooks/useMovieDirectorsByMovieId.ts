import { useQuery } from '@tanstack/react-query';
import { getMovieDirectorsByMovieId } from '../api/movies.api';

export function useMovieDirectorsByMovieId(movieId: number | string | undefined) {
  return useQuery({
    queryKey: ['movieDirectors', movieId],
    queryFn: () => getMovieDirectorsByMovieId(movieId as number | string),
    enabled: !!movieId,
  });
}
