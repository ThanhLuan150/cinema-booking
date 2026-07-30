import apiClient from 'services/apiClient';
import type { Movie } from '@/types/entities';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type { CastMemberDraft, MovieFormValues } from '../types/adminMovie.types';

export function buildMovieFormData(
  values: Omit<MovieFormValues, 'cast'>,
  cast: CastMemberDraft[],
  avatarFile?: File | null,
  trailerFile?: File | null,
) {
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, String(value));
  });
  formData.append('cast', JSON.stringify(cast.filter((member) => member.name.trim() !== '')));
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
