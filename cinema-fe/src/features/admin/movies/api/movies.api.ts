import apiClient from 'services/apiClient';
import type { Movie, MovieActorLink, MovieDirectorLink } from '@/types/entities';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type { MovieFormValues } from '../types/adminMovie.types';

export function buildMovieFormData(values: MovieFormValues, avatarFile?: File | null, trailerFile?: File | null) {
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, String(value));
  });
  if (avatarFile) formData.append('avatar', avatarFile);
  if (trailerFile) formData.append('trailer', trailerFile);
  return formData;
}

// Management listing: admin sees every movie, a theater owner only sees the ones they added.
export const getMyMovies = (params?: PaginationParams) =>
  apiClient.get<PaginatedResponse<Movie>>('/movie/mine', { params }).then((res) => res.data);

export const getMovieCategoriesByMovieId = (id: number | string) =>
  apiClient.get<number[]>(`/movieCat/${id}`).then((res) => res.data);

export const createMovie = (payload: FormData) => apiClient.post<{ id: number }>('/movie', payload);

export const addMovieCategory = (payload: { movie_id: number | string; cat_id: number }) =>
  apiClient.post('/movieCat', payload);

export const updateMovie = (id: number | string, payload: FormData) => apiClient.put(`/movie/${id}`, payload);

export const deleteMovie = (id: number | string) => apiClient.delete(`/movie/${id}`);

export const deleteMovieCategoryByMovieId = (id: number | string) => apiClient.delete(`/movieCat/${id}`);

export const getMovieDirectorsByMovieId = (id: number | string) =>
  apiClient.get<MovieDirectorLink[]>(`/movieDirector/${id}`).then((res) => res.data);

export const addMovieDirector = (payload: { movie_id: number | string; director_id: number }) =>
  apiClient.post('/movieDirector', payload);

export const deleteMovieDirectorByMovieId = (id: number | string) => apiClient.delete(`/movieDirector/${id}`);

export const getMovieActorsByMovieId = (id: number | string) =>
  apiClient.get<MovieActorLink[]>(`/movieActor/${id}`).then((res) => res.data);

export const addMovieActor = (payload: {
  movie_id: number | string;
  actor_id: number;
  character_name: string;
  is_lead: boolean;
}) => apiClient.post('/movieActor', payload);

export const deleteMovieActorByMovieId = (id: number | string) => apiClient.delete(`/movieActor/${id}`);
