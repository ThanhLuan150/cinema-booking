import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  createMovieRelease,
  deleteMovieRelease,
  getMovieReleases,
  updateMovieRelease,
  type MovieReleaseFilters,
  type MovieReleasePayload,
} from '../api/distribution.api';
import type { PaginationParams } from '@/types/pagination';

export const movieReleasesQueryKey = ['movieReleases'] as const;

export function useMovieReleases(
  filters: MovieReleaseFilters = {},
  pagination: PaginationParams = {},
  enabled = true,
) {
  return useQuery({
    queryKey: [...movieReleasesQueryKey, filters, pagination],
    queryFn: () => getMovieReleases({ ...filters, ...pagination }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: movieReleasesQueryKey });
}

export function useCreateMovieRelease() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: MovieReleasePayload) => createMovieRelease(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateMovieRelease() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<MovieReleasePayload> & { id: number | string }) =>
      updateMovieRelease(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteMovieRelease() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number | string) => deleteMovieRelease(id),
    onSuccess: invalidate,
  });
}
