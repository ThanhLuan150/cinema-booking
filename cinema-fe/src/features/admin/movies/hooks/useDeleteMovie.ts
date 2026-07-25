import { useMutation, useQueryClient } from '@tanstack/react-query';
import { moviesQueryKey } from '@/features/movies/hooks/useMovies';
import { myMoviesQueryKey } from './useMyMovies';
import { deleteMovie, deleteMovieCategoryByMovieId } from '../api/movies.api';

export function useDeleteMovie() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (movieId: number | string) => {
      await deleteMovie(movieId);
      try {
        await deleteMovieCategoryByMovieId(movieId);
      } catch {
        // categories may already be gone — not fatal to the delete itself
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moviesQueryKey });
      queryClient.invalidateQueries({ queryKey: myMoviesQueryKey });
    },
  });
}
