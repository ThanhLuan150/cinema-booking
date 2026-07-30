import { useMutation, useQueryClient } from '@tanstack/react-query';
import { moviesQueryKey } from '@/features/movies/hooks/useMovies';
import { myMoviesQueryKey } from './useMyMovies';
import { createMovie, addMovieCategory, buildMovieFormData } from '../api/movies.api';
import type { CreateMoviePayload } from '../types/adminMovie.types';

export function useCreateMovie() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateMoviePayload) => {
      const { categoryIds, cast, avatarFile, trailerFile, ...rest } = payload;
      const response = await createMovie(buildMovieFormData(rest, cast, avatarFile, trailerFile));
      for (const categoryId of categoryIds) {
        await addMovieCategory({ movie_id: response.data.id, cat_id: categoryId });
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moviesQueryKey });
      queryClient.invalidateQueries({ queryKey: myMoviesQueryKey });
    },
  });
}
