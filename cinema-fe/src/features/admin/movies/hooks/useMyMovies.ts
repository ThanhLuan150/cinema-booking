import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getMyMovies } from '../api/movies.api';

export const myMoviesQueryKey = ['myMovies'] as const;

export function useMyMovies(page: number, limit: number) {
  return useQuery({
    queryKey: [...myMoviesQueryKey, page, limit],
    queryFn: () => getMyMovies({ page, limit }),
    placeholderData: keepPreviousData,
  });
}
