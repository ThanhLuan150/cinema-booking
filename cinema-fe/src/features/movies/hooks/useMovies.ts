import { useQuery } from '@tanstack/react-query';
import { getMovies } from '../api/movies.api';
import type { MovieFilters } from '../types/movie.types';

export const moviesQueryKey = ['movies'] as const;

export function useMovies(filters?: MovieFilters) {
  return useQuery({
    queryKey: [...moviesQueryKey, filters ?? {}],
    queryFn: () => getMovies(filters),
  });
}
