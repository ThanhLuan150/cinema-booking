import { useMutation, useQueryClient } from '@tanstack/react-query';
import { moviesQueryKey } from '@/features/movies/hooks/useMovies';
import { myMoviesQueryKey } from './useMyMovies';
import { updateMovie, addMovieCategory, buildMovieFormData } from '../api/movies.api';
import type { UpdateMoviePayload } from '../types/adminMovie.types';

export function useUpdateMovie() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values, categoryIds, avatarFile, trailerFile }: UpdateMoviePayload) => {
      const { cast, ...rest } = values;
      await updateMovie(id, buildMovieFormData(rest, cast, avatarFile, trailerFile));
      for (const categoryId of categoryIds) {
        await addMovieCategory({ movie_id: id, cat_id: categoryId });
      }
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: moviesQueryKey });
      queryClient.invalidateQueries({ queryKey: myMoviesQueryKey });
      queryClient.invalidateQueries({ queryKey: ['movie', id] });
      queryClient.invalidateQueries({ queryKey: ['movieCategories', id] });
    },
  });
}
