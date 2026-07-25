import { useQuery } from '@tanstack/react-query';
import { getMovieById } from '../api/movies.api';

export function useMovieDetail(movieId: string | number | undefined) {
  return useQuery({
    queryKey: ['movie', movieId],
    queryFn: () => getMovieById(movieId as string | number),
    enabled: !!movieId,
  });
}
