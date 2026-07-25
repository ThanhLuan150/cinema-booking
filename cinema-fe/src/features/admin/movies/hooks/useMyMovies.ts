import { useQuery } from '@tanstack/react-query';
import { getMyMovies } from '../api/movies.api';

export const myMoviesQueryKey = ['myMovies'] as const;

export function useMyMovies() {
  return useQuery({
    queryKey: myMoviesQueryKey,
    queryFn: getMyMovies,
  });
}
