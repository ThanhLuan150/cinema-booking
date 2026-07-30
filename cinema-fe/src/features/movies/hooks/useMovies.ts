import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getMovies } from '../api/movies.api';
import type { MovieFilters } from '../types/movie.types';
import type { PaginationParams } from '@/types/pagination';

export const moviesQueryKey = ['movies'] as const;

export function useMovies(filters?: MovieFilters, pagination?: PaginationParams) {
  return useQuery({
    queryKey: [...moviesQueryKey, filters ?? {}, pagination ?? {}],
    queryFn: () => getMovies(filters, pagination),
    placeholderData: keepPreviousData,
  });
}
