import { useMutation, useQueryClient } from '@tanstack/react-query';
import { moviesQueryKey } from '@/features/movies/hooks/useMovies';
import { myMoviesQueryKey } from './useMyMovies';
import {
  updateMovie,
  addMovieCategory,
  deleteMovieCategoryByMovieId,
  addMovieDirector,
  deleteMovieDirectorByMovieId,
  addMovieActor,
  deleteMovieActorByMovieId,
  buildMovieFormData,
} from '../api/movies.api';
import type { UpdateMoviePayload } from '../types/adminMovie.types';

export function useUpdateMovie() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
      categoryIds,
      directorIds,
      actors,
      avatarFile,
      trailerFile,
      producerAvatarFile,
    }: UpdateMoviePayload) => {
      await updateMovie(id, buildMovieFormData(values, avatarFile, trailerFile, producerAvatarFile));

      await deleteMovieCategoryByMovieId(id);
      for (const categoryId of categoryIds) {
        await addMovieCategory({ movie_id: id, cat_id: categoryId });
      }

      await deleteMovieDirectorByMovieId(id);
      for (const directorId of directorIds) {
        await addMovieDirector({ movie_id: id, director_id: directorId });
      }

      await deleteMovieActorByMovieId(id);
      for (const actor of actors) {
        await addMovieActor({
          movie_id: id,
          actor_id: actor.actor_id,
          character_name: actor.character_name,
          is_lead: actor.is_lead,
        });
      }
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: moviesQueryKey });
      queryClient.invalidateQueries({ queryKey: myMoviesQueryKey });
      queryClient.invalidateQueries({ queryKey: ['movie', id] });
      queryClient.invalidateQueries({ queryKey: ['movieCategories', id] });
      queryClient.invalidateQueries({ queryKey: ['movieDirectors', id] });
      queryClient.invalidateQueries({ queryKey: ['movieActors', id] });
    },
  });
}
