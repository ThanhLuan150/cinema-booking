import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getMyMovies } from '../api/movies.api';

export const myMoviesQueryKey = ['myMovies'] as const;

export function useMyMovies(page: number, limit: number, status?: 'ACTIVE' | 'INACTIVE') {
  return useQuery({
    queryKey: [...myMoviesQueryKey, page, limit, status],
    queryFn: () => getMyMovies({ page, limit, status }),
    placeholderData: keepPreviousData,
  });
}
