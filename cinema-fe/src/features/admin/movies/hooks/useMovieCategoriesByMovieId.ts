import { useQuery } from '@tanstack/react-query';
import { getMovieCategoriesByMovieId } from '../api/movies.api';

export function useMovieCategoriesByMovieId(movieId: number | string | undefined) {
  return useQuery({
    queryKey: ['movieCategories', movieId],
    queryFn: () => getMovieCategoriesByMovieId(movieId as number | string),
    enabled: !!movieId,
  });
}
