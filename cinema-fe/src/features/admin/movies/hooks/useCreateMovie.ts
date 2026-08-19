import { useMutation, useQueryClient } from '@tanstack/react-query';
import { moviesQueryKey } from '@/features/movies/hooks/useMovies';
import { myMoviesQueryKey } from './useMyMovies';
import { createMovie, addMovieCategory, addMovieDirector, addMovieActor, buildMovieFormData } from '../api/movies.api';
import type { CreateMoviePayload } from '../types/adminMovie.types';

export function useCreateMovie() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateMoviePayload) => {
      const { categoryIds, directorIds, actors, avatarFile, trailerFile, producerAvatarFile, ...rest } = payload;
      const response = await createMovie(buildMovieFormData(rest, avatarFile, trailerFile, producerAvatarFile));
      const movieId = response.data.id;
      for (const categoryId of categoryIds) {
        await addMovieCategory({ movie_id: movieId, cat_id: categoryId });
      }
      for (const directorId of directorIds) {
        await addMovieDirector({ movie_id: movieId, director_id: directorId });
      }
      for (const actor of actors) {
        await addMovieActor({
          movie_id: movieId,
          actor_id: actor.actor_id,
          character_name: actor.character_name,
          is_lead: actor.is_lead,
        });
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moviesQueryKey });
      queryClient.invalidateQueries({ queryKey: myMoviesQueryKey });
    },
  });
}
